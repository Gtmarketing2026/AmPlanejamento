"""
Upload manual de extrato/fatura (Plano Essencial) — OFX, CSV ou PDF.

Fluxo: salva o arquivo original no Supabase Storage -> registra a
importação -> processa com o parser do formato correspondente -> insere
as transações com dedup (mesma lógica que a sincronização automática via
Open Finance vai usar no futuro, ver hash_dedup em app/parsers/dedup.py).
"""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.integrations.openai_categorizador import ClassificacaoIndisponivel, classificar_transacoes
from app.integrations.supabase_storage import excluir_arquivo, upload_arquivo
from app.models.categoria import Categoria, Subcategoria
from app.models.cliente import Cliente
from app.models.conta_conectada import ContaConectada
from app.models.importacao_extrato import ImportacaoExtrato
from app.models.transacao import Transacao
from app.parsers.csv_parser import CsvFormatoInvalido, parse_csv
from app.parsers.dedup import calcular_hash_dedup
from app.parsers.ofx_parser import parse_ofx
from app.parsers.pdf_parser import parse_pdf
from app.schemas.importacao import ImportacaoResposta, TransacaoAtualizar, TransacaoResposta

router = APIRouter(tags=["importacoes"])

TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10MB
FORMATOS_ACEITOS = {"ofx", "csv", "pdf"}
TIPOS_DOCUMENTO = {"extrato", "fatura_cartao"}


def _obter_ou_criar_conta_manual(
    db: Session, cliente_id: uuid.UUID, profissional_id: uuid.UUID
) -> ContaConectada:
    """Toda importação manual fica ligada a UMA conta_conectada modo='manual'
    por cliente (reaproveitada entre uploads) -- é o mesmo conceito que uma
    conexão Open Finance, só que alimentada por arquivo em vez de sincronia."""
    conta = db.scalar(
        select(ContaConectada).where(
            ContaConectada.cliente_id == cliente_id, ContaConectada.modo == "manual"
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


@router.post("/importacoes", response_model=ImportacaoResposta, status_code=status.HTTP_201_CREATED)
async def criar_importacao(
    cliente_id: uuid.UUID = Form(...),
    tipo_documento: str = Form(...),
    periodo_inicio: date | None = Form(None),
    periodo_fim: date | None = Form(None),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    if tipo_documento not in TIPOS_DOCUMENTO:
        raise HTTPException(status_code=422, detail="tipo_documento inválido")

    # RLS garante que só clientes do próprio profissional são encontrados aqui.
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    nome_arquivo = arquivo.filename or "arquivo"
    extensao = nome_arquivo.rsplit(".", 1)[-1].lower() if "." in nome_arquivo else ""
    if extensao not in FORMATOS_ACEITOS:
        raise HTTPException(status_code=422, detail="Formato aceito: OFX, CSV ou PDF")

    conteudo = await arquivo.read()
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(status_code=413, detail="Arquivo maior que 10MB")

    conta = _obter_ou_criar_conta_manual(db, cliente_id, profissional_id)
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
        enviado_por="profissional",
    )
    db.add(importacao)
    db.flush()

    try:
        if extensao == "ofx":
            transacoes_parseadas = parse_ofx(conteudo)
        elif extensao == "csv":
            transacoes_parseadas = parse_csv(conteudo)
        else:
            transacoes_parseadas = parse_pdf(conteudo)
    except CsvFormatoInvalido as e:
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

    origem = "cartao" if tipo_documento == "fatura_cartao" else "conta"
    importadas = 0
    duplicadas = 0
    inseridas = []  # [{"id", "descricao", "tipo"}] -- só as que entraram de fato (não duplicadas)
    for t in transacoes_parseadas:
        hash_dedup = calcular_hash_dedup(conta.id, t["data"], t["valor"], t["descricao"])
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

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(transacao, campo, valor)

    db.add(transacao)
    db.flush()
    db.refresh(transacao)
    return transacao
