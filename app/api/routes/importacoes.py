"""
Upload manual de extrato/fatura (Plano Essencial) — OFX, CSV ou PDF.

Fluxo: salva o arquivo original no Supabase Storage -> registra a
importação -> processa com o parser do formato correspondente -> insere
as transações com dedup (mesma lógica que a sincronização automática via
Open Finance vai usar no futuro, ver hash_dedup em app/parsers/dedup.py).
"""

import re
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.integrations.openai_categorizador import ClassificacaoIndisponivel, classificar_transacoes
from app.integrations.supabase_storage import excluir_arquivo, upload_arquivo
from app.models.categoria import Categoria, Subcategoria
from app.models.cliente import Cliente
from app.models.conta_conectada import ContaConectada
from app.models.importacao_extrato import ImportacaoExtrato
from app.models.preferencia_cliente import PreferenciaCliente
from app.models.transacao import Transacao
from app.parsers.csv_parser import CsvFormatoInvalido, parse_csv
from app.parsers.dedup import calcular_hash_dedup
from app.parsers.ofx_parser import parse_ofx
from app.parsers.pdf_parser import PdfProtegido, parse_pdf
from app.schemas.importacao import ImportacaoResposta, TransacaoAtualizar, TransacaoResposta

router = APIRouter(tags=["importacoes"])

TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10MB
FORMATOS_ACEITOS = {"ofx", "csv", "pdf"}
TIPOS_DOCUMENTO = {"extrato", "fatura_cartao"}

# Linhas de resumo/total/saldo transportado que o parser de PDF/CSV pode
# confundir com uma transação de verdade (têm data + valor na mesma linha,
# igual uma transação real) -- ex: "Total de compras a 25/06 ... R$463,73"
# ou "Fatura anterior R$3.046,34" num extrato de cartão. O objetivo é manter
# só compras e parcelamentos de verdade. Melhor esforço (regex, não é
# possível cobrir 100% dos formatos de banco).
_PADRAO_LINHA_AGREGADA = re.compile(
    r"\b(total(?:\s+(?:de\s+compras(?:\s+parceladas)?|da\s+fatura|geral|a\s+pagar(?:\s+do\s+cart[aã]o)?))?|"
    r"subtotal|saldo\s+(?:anterior|atual|final|dispon[ií]vel)|valor\s+total|"
    r"limite\s+(?:dispon[ií]vel|total|de\s+cr[eé]dito)|fatura\s+anterior|"
    r"pagamentos?\s+(?:efetuados?|recebidos?)|tarifa|anuidade)\b",
    re.IGNORECASE,
)


def _e_linha_agregada(descricao: str) -> bool:
    return bool(_PADRAO_LINHA_AGREGADA.search(descricao))


def _obter_conta_do_upload(
    db: Session,
    cliente_id: uuid.UUID,
    profissional_id: uuid.UUID,
    conta_conectada_id: uuid.UUID | None,
) -> ContaConectada:
    """Se o caller já cadastrou a conta/cartão em "Minhas Contas" (ver
    app/api/routes/contas.py) e escolheu ela no upload, usa essa. Senão, cai
    de volta pra UMA conta_conectada genérica modo='manual' por cliente
    (comportamento anterior, mantido pra quem ainda não cadastrou contas)."""
    if conta_conectada_id is not None:
        conta = db.get(ContaConectada, conta_conectada_id)
        if conta is None or conta.cliente_id != cliente_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta/cartão não encontrado")
        return conta

    conta = db.scalar(
        select(ContaConectada).where(
            ContaConectada.cliente_id == cliente_id, ContaConectada.modo == "manual",
            ContaConectada.natureza == "conta", ContaConectada.nome_exibicao.is_(None),
        )
    )
    if conta:
        return conta
    conta = ContaConectada(
        cliente_id=cliente_id,
        profissional_id=profissional_id,
        modo="manual",
        status="ativa",
    )
    db.add(conta)
    db.flush()
    return conta


def _calcular_mes_referencia(data_transacao: date, natureza: str, dia_virada: int | None, modo_visualizacao: str) -> date:
    """1º dia do mês em que o gasto "conta" pro cliente. Por padrão (ou pra
    contas/cartões sem dia de virada configurado) é o próprio mês calendário
    de `data_transacao`. Com a preferência "virada_cartao" e um cartão com
    dia_virada definido, compras feitas DEPOIS da virada contam pro mês
    seguinte -- ex: cartão vira todo dia 19, uma compra em 25/06 é gasto de
    julho (o "mês" desse cliente vai de 19/06 a 18/07), não de junho."""
    mes_calendario = date(data_transacao.year, data_transacao.month, 1)
    if modo_visualizacao != "virada_cartao" or natureza != "cartao" or not dia_virada:
        return mes_calendario
    if data_transacao.day <= dia_virada:
        return mes_calendario
    if data_transacao.month == 12:
        return date(data_transacao.year + 1, 1, 1)
    return date(data_transacao.year, data_transacao.month + 1, 1)


def processar_upload(
    db: Session,
    cliente_id: uuid.UUID,
    profissional_id: uuid.UUID,
    tipo_documento: str,
    nome_arquivo: str,
    conteudo: bytes,
    periodo_inicio: date | None,
    periodo_fim: date | None,
    enviado_por: str,  # 'profissional' | 'cliente_final'
    senha_pdf: str | None = None,
    conta_conectada_id: uuid.UUID | None = None,
) -> ImportacaoExtrato:
    """Núcleo do upload de extrato/fatura, compartilhado entre a rota do
    planejador (/importacoes) e a do cliente final (/clientes/eu/importacoes):
    valida formato, salva no storage, faz parse + dedup + classificação por IA.
    O caller já validou o cliente e a permissão; aqui só processa."""
    if tipo_documento not in TIPOS_DOCUMENTO:
        raise HTTPException(status_code=422, detail="tipo_documento inválido")

    extensao = nome_arquivo.rsplit(".", 1)[-1].lower() if "." in nome_arquivo else ""
    if extensao not in FORMATOS_ACEITOS:
        raise HTTPException(status_code=422, detail="Formato aceito: OFX, CSV ou PDF")
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo maior que 10MB")

    conta = _obter_conta_do_upload(db, cliente_id, profissional_id, conta_conectada_id)
    caminho_storage = upload_arquivo(conteudo, nome_arquivo, profissional_id)

    importacao = ImportacaoExtrato(
        conta_conectada_id=conta.id,
        cliente_id=cliente_id,
        profissional_id=profissional_id,
        tipo_documento=tipo_documento,
        formato_arquivo=extensao,
        arquivo_url=caminho_storage,
        periodo_inicio=periodo_inicio,
        periodo_fim=periodo_fim,
        status="processando",
        enviado_por=enviado_por,
    )
    db.add(importacao)
    db.flush()

    try:
        if extensao == "ofx":
            transacoes_parseadas = parse_ofx(conteudo)
        elif extensao == "csv":
            transacoes_parseadas = parse_csv(conteudo)
        else:
            transacoes_parseadas = parse_pdf(conteudo, senha=senha_pdf)
    except CsvFormatoInvalido as e:
        importacao.status = "erro"
        importacao.erro_detalhe = str(e)
        db.flush()
        db.refresh(importacao)
        return importacao
    except PdfProtegido as e:
        importacao.status = "erro"
        importacao.erro_detalhe = str(e)
        db.flush()
        db.refresh(importacao)
        return importacao
    except Exception as e:
        # PDF/OFX malformado, etc. -- nunca deixa a importação travada em
        # "processando" pra sempre, marca erro com o detalhe.
        importacao.status = "erro"
        importacao.erro_detalhe = f"Falha ao processar arquivo: {e}"
        db.flush()
        db.refresh(importacao)
        return importacao

    # Descarta linhas de resumo/total (ver _e_linha_agregada) -- não são
    # lançamentos de verdade, só apareceriam duplicando o gasto do período.
    transacoes_parseadas = [t for t in transacoes_parseadas if not _e_linha_agregada(t["descricao"])]

    if tipo_documento == "fatura_cartao":
        # Os parsers assumem a convenção de extrato bancário (valor positivo
        # = entrada/crédito). Numa fatura de cartão é o oposto: cada linha
        # positiva é uma compra (gasto), e só um valor negativo no documento
        # (ex: um estorno) representa um crédito de volta -- por isso inverte
        # o tipo aqui em vez de nos parsers, que continuam genéricos.
        for t in transacoes_parseadas:
            t["tipo"] = "saida" if t["tipo"] == "entrada" else "entrada"

    origem = "cartao" if tipo_documento == "fatura_cartao" else "conta"
    preferencia = db.get(PreferenciaCliente, cliente_id)
    modo_visualizacao = preferencia.visualizacao_lancamento if preferencia else "data_compra"
    importadas = 0
    duplicadas = 0
    inseridas = []  # [{"id", "descricao", "tipo"}] -- só as que entraram de fato (não duplicadas)
    for t in transacoes_parseadas:
        hash_dedup = calcular_hash_dedup(conta.id, t["data"], t["valor"], t["descricao"])
        mes_referencia = _calcular_mes_referencia(t["data"], conta.natureza, conta.dia_virada, modo_visualizacao)
        stmt = (
            pg_insert(Transacao)
            .values(
                conta_conectada_id=conta.id,
                cliente_id=cliente_id,
                profissional_id=profissional_id,
                data=t["data"],
                descricao=t["descricao"],
                valor=t["valor"],
                tipo=t["tipo"],
                origem=origem,
                importacao_id=importacao.id,
                hash_dedup=hash_dedup,
                mes_referencia=mes_referencia,
            )
            .on_conflict_do_nothing(index_elements=["conta_conectada_id", "hash_dedup"])
            .returning(Transacao.id)
        )
        resultado = db.execute(stmt)
        linha = resultado.first()
        if linha:
            importadas += 1
            inseridas.append({"id": linha[0], "descricao": t["descricao"], "tipo": t["tipo"]})
        else:
            duplicadas += 1

    # Classificação automática via IA logo após a importação -- uma chamada
    # pra leva inteira. Se a OpenAI falhar por qualquer motivo, as transações
    # ficam sem categoria (classificável manualmente depois, ver PATCH
    # /transacoes/{id}) e a importação segue normalmente -- nunca trava aqui.
    if inseridas:
        categorias = db.scalars(select(Categoria)).all()
        subcategorias = db.scalars(select(Subcategoria)).all()
        try:
            classificacoes = classificar_transacoes(
                [{"descricao": i["descricao"], "tipo": i["tipo"]} for i in inseridas],
                categorias,
                subcategorias,
            )
            categorias_por_nome = {c.nome.strip().lower(): c.id for c in categorias}
            subcategorias_por_nome = {s.nome.strip().lower(): s.id for s in subcategorias}
            for item, classif in zip(inseridas, classificacoes):
                categoria_id = categorias_por_nome.get((classif.get("categoria") or "").strip().lower())
                subcategoria_id = subcategorias_por_nome.get((classif.get("subcategoria") or "").strip().lower())
                if categoria_id or subcategoria_id:
                    db.execute(
                        update(Transacao)
                        .where(Transacao.id == item["id"])
                        .values(categoria_id=categoria_id, subcategoria_id=subcategoria_id)
                    )
        except ClassificacaoIndisponivel:
            pass

    importacao.status = "processado"
    importacao.transacoes_importadas = importadas
    importacao.transacoes_duplicadas = duplicadas
    importacao.processado_em = datetime.now(timezone.utc)
    db.flush()
    db.refresh(importacao)
    return importacao


@router.post("/importacoes", response_model=ImportacaoResposta, status_code=status.HTTP_201_CREATED)
async def criar_importacao(
    cliente_id: uuid.UUID = Form(...),
    tipo_documento: str = Form(...),
    periodo_inicio: date | None = Form(None),
    periodo_fim: date | None = Form(None),
    senha_pdf: str | None = Form(None),
    conta_conectada_id: uuid.UUID | None = Form(None),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    # RLS garante que só clientes do próprio profissional são encontrados aqui.
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    conteudo = await arquivo.read()
    return processar_upload(
        db, cliente_id, profissional_id, tipo_documento,
        arquivo.filename or "arquivo", conteudo, periodo_inicio, periodo_fim, "profissional",
        senha_pdf=senha_pdf or None, conta_conectada_id=conta_conectada_id,
    )


@router.get("/importacoes", response_model=list[ImportacaoResposta])
def listar_importacoes(cliente_id: uuid.UUID | None = None, db: Session = Depends(get_db_com_rls)):
    query = select(ImportacaoExtrato).order_by(ImportacaoExtrato.criado_em.desc())
    if cliente_id:
        query = query.where(ImportacaoExtrato.cliente_id == cliente_id)
    return db.scalars(query).all()


@router.delete("/importacoes/{importacao_id}", status_code=status.HTTP_200_OK)
def excluir_importacao(importacao_id: uuid.UUID, db: Session = Depends(get_db_com_rls)):
    importacao = db.get(ImportacaoExtrato, importacao_id)
    if not importacao:
        raise HTTPException(status_code=404, detail="Importação não encontrada")

    # Exclusão em cascata de verdade: apagar os lançamentos, não só desligar
    # a referência (o FK é ON DELETE SET NULL, que orfanaria as transações
    # em vez de removê-las -- não é o que o produto quer aqui).
    transacoes = db.scalars(select(Transacao).where(Transacao.importacao_id == importacao_id)).all()
    qtd_removida = len(transacoes)
    for t in transacoes:
        db.delete(t)

    try:
        excluir_arquivo(importacao.arquivo_url)
    except Exception:
        pass  # arquivo já pode ter sido removido; não bloqueia a exclusão do registro

    db.delete(importacao)
    db.flush()

    return {"transacoes_removidas": qtd_removida}


@router.get("/transacoes", response_model=list[TransacaoResposta])
def listar_transacoes(cliente_id: uuid.UUID, db: Session = Depends(get_db_com_rls)):
    transacoes = db.scalars(
        select(Transacao).where(Transacao.cliente_id == cliente_id).order_by(Transacao.data.desc())
    ).all()
    return transacoes


@router.patch("/transacoes/{transacao_id}", response_model=TransacaoResposta)
def atualizar_transacao(
    transacao_id: uuid.UUID, dados: TransacaoAtualizar, db: Session = Depends(get_db_com_rls)
):
    # RLS já garante que só transações do próprio profissional aparecem aqui
    # -- reclassificação manual (planejador) da categoria/subcategoria
    # sugerida automaticamente pela IA na importação.
    transacao = db.get(Transacao, transacao_id)
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    campos = dados.model_dump(exclude_unset=True, exclude={"aplicar_a_todos_iguais"})
    for campo, valor in campos.items():
        setattr(transacao, campo, valor)

    quantidade_atualizada = None
    if dados.aplicar_a_todos_iguais:
        outras = db.scalars(
            select(Transacao).where(
                Transacao.cliente_id == transacao.cliente_id,
                Transacao.id != transacao_id,
                func.lower(Transacao.descricao) == transacao.descricao.lower(),
            )
        ).all()
        for outra in outras:
            outra.categoria_id = transacao.categoria_id
            outra.subcategoria_id = transacao.subcategoria_id
        quantidade_atualizada = len(outras)

    db.add(transacao)
    db.flush()
    db.refresh(transacao)
    resposta = TransacaoResposta.model_validate(transacao)
    resposta.quantidade_atualizada = quantidade_atualizada
    return resposta


@router.delete("/transacoes/{transacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_transacao(transacao_id: uuid.UUID, db: Session = Depends(get_db_com_rls)):
    transacao = db.get(Transacao, transacao_id)
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    db.delete(transacao)
