"""
Upload manual de extrato/fatura (Plano Essencial) — OFX, CSV ou PDF.

Fluxo: salva o arquivo original no Supabase Storage -> registra a
importação -> processa com o parser do formato correspondente -> insere
as transações com dedup (mesma lógica que a sincronização automática via
Open Finance vai usar no futuro, ver hash_dedup em app/parsers/dedup.py).
"""

import hashlib
import re
import time
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.integrations.openai_categorizador import (
    ClassificacaoIndisponivel,
    classificar_transacoes,
    extrair_transacoes_ocr,
)
from app.integrations.ocr_vision import OcrIndisponivel, ocr_disponivel, ocr_pdf
from app.integrations.regras_categoria import classificar_por_regra
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
from app.schemas.importacao import (
    ImportacaoResposta,
    ReclassificarRequest,
    TransacaoAtualizar,
    TransacaoResposta,
)

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
    r"\b(total(?:\s+de\s+(?:compras(?:\s+parceladas)?|entradas|sa[íi]das|cr[eé]ditos|d[eé]bitos|lan[çc]amentos))?"
    r"(?:\s+(?:da\s+fatura|geral|a\s+pagar(?:\s+do\s+cart[aã]o)?))?|"
    r"subtotal|saldo\s+(?:anterior|atual|final|inicial|dispon[ií]vel|do\s+per[ií]odo)|valor\s+total|"
    r"limite\s+(?:dispon[ií]vel|total|de\s+cr[eé]dito)|fatura\s+anterior|"
    r"pagamentos?\s*(?:efetuados?|recebidos?)|"
    r"resumo(?:\s+do\s+per[ií]odo)?|"
    r"despesas\s+futuras|pr[óo]xim[ao]s?\s+fatura|faturas?\s+nos?\s+pr[óo]ximos?\s+meses|"
    r"parcelas?\s+e\s+transa[çc][õo]es\s+de|fechamento|vencimento)\b",
    re.IGNORECASE,
)

# Linha de resumo do período que traz entradas E saídas juntas (ex:
# "Entradas: R$ 14.996,73 • Saídas: R$ ...") -- é rodapé/cabeçalho de totais,
# não um lançamento. Exige os DOIS termos pra não pegar um lançamento real que
# por acaso tenha "entrada"/"saída" na descrição.
_PADRAO_ENTRADAS = re.compile(r"\bentradas?\b", re.IGNORECASE)
_PADRAO_SAIDAS = re.compile(r"\bsa[íi]das?\b", re.IGNORECASE)

# Faixa de datas na descrição (ex: "01/06/2026 - 30/06/2026") -- é cabeçalho de
# um período de resumo, nunca um lançamento individual. O parser às vezes quebra
# o bloco de totais em pedaços, então cada fragmento precisa ser barrado.
_PADRAO_FAIXA_DATAS = re.compile(
    r"\d{2}/\d{2}/\d{4}\s*[-–—a]\s*\d{2}/\d{2}/\d{4}", re.IGNORECASE
)
# Rótulo de total com dois-pontos (ex: "Entradas:", "Saídas:", "Créditos:") --
# um lançamento real não vem rotulado assim. Pega os fragmentos de resumo que
# têm só um dos termos (ex: "... ) Entradas:").
_PADRAO_TOTAL_ROTULO = re.compile(
    r"\b(entradas?|sa[íi]das?|cr[eé]ditos?|d[eé]bitos?)\s*:", re.IGNORECASE
)


# Crédito/estorno numa fatura de cartão (ex: "CRÉDITO CONCEDIDO", "ESTORNO",
# "DEVOLUÇÃO") -- devolve dinheiro/abate a fatura, NÃO é uma despesa. Force pra
# 'entrada' mesmo que a inversão da fatura tenha marcado como saída.
_PADRAO_CREDITO_FATURA = re.compile(
    r"\b(cr[eé]dito\s+concedido|cr[eé]dito\s+recebido|estorno|estornad[oa]|"
    r"devolu[çc][ãa]o|reembolso|cancelamento\s+de\s+compra|ajuste\s+a\s+cr[eé]dito)\b",
    re.IGNORECASE,
)

# Entradas que são renda de verdade (salário, proventos, aposentadoria, pró-
# labore) -> categoria 'Renda'. PIX recebido genérico NÃO entra aqui (ambíguo:
# pode ser transferência) e fica sem categoria pra classificar depois.
_PADRAO_RENDA = re.compile(
    r"\b(sal[aá]rio|proventos?|rendimento|aposentadoria|pens[ãa]o|"
    r"pr[oó][\s-]*labore|13[º°]?\s*sal[aá]rio|b[oô]nus)\b",
    re.IGNORECASE,
)

# "R$" corrompido por fonte quebrada (glifos não mapeados p/ Unicode) vira "$z".
_PADRAO_MOEDA_QUEBRADA = re.compile(r"\$z", re.IGNORECASE)


def _descricao_ilegivel(descricao: str) -> bool:
    """Heurística: a descrição parece lixo de extração (fonte com ToUnicode
    quebrado)? Usa só sinais FORTES e específicos pra não recusar descrições
    legítimas (ex: 'MP*62587963THALE', que tem ID numérico mas é válida):
    - caractere de substituição � (glifo não mapeado -- universal);
    - "R$" corrompido em "$z";
    - descrição dominada por símbolos (dígitos e letras contam como válidos)."""
    d = descricao or ""
    if "�" in d:  # caractere de substituição Unicode (glifo não mapeado)
        return True
    if _PADRAO_MOEDA_QUEBRADA.search(d):
        return True
    nao_espaco = [c for c in d if not c.isspace()]
    if len(nao_espaco) >= 8:
        alfanum = sum(1 for c in nao_espaco if c.isalnum())
        if alfanum / len(nao_espaco) < 0.35:  # dominado por símbolos ($ % / etc.), não por dígitos/letras
            return True
    return False


def _e_linha_agregada(descricao: str) -> bool:
    if _PADRAO_LINHA_AGREGADA.search(descricao):
        return True
    if _PADRAO_ENTRADAS.search(descricao) and _PADRAO_SAIDAS.search(descricao):
        return True
    if _PADRAO_FAIXA_DATAS.search(descricao):
        return True
    if _PADRAO_TOTAL_ROTULO.search(descricao):
        return True
    return False


def _transacao_valida(t: dict) -> bool:
    """Trava central de sanidade -- defesa em profundidade contra QUALQUER
    parser (PDF/CSV/OFX/OCR) devolver algo que não é um lançamento de verdade.
    Foi exatamente aqui que o caso Sabrina falhou: linhas de "saldo do dia"
    (data + valor, SEM descrição) entraram como entradas fantasmas. Barra:
      - sem data;
      - descrição vazia (linha de saldo/subtotal, não é lançamento);
      - valor ausente/não-numérico ou zero (tarifa R$0,00, rodapé)."""
    if not t.get("data"):
        return False
    if not (t.get("descricao") or "").strip():
        return False
    try:
        if abs(float(t.get("valor"))) <= 0:
            return False
    except (TypeError, ValueError):
        return False
    return True


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
    dia_virada definido, a fatura é nomeada pelo MÊS EM QUE O GASTO OCORREU
    (mesmo que só seja paga no mês seguinte). O dia da virada é o PRIMEIRO dia
    do novo ciclo. Ex: cartão vira dia 9 -> a fatura de maio cobre 09/05 a
    08/06. Então:
      - compra em 09/05 (dia >= virada): começa o ciclo deste mês -> maio;
      - compra em 08/06 (dia < virada): ainda é o ciclo do mês anterior -> maio;
      - compra em 08/05 (dia < virada): ciclo de abril -> abril;
      - compra em 09/06 (dia >= virada): já é o ciclo de junho -> junho."""
    mes_calendario = date(data_transacao.year, data_transacao.month, 1)
    if modo_visualizacao != "virada_cartao" or natureza != "cartao" or not dia_virada:
        return mes_calendario
    if data_transacao.day >= dia_virada:
        # A partir da virada (inclusive): começa o ciclo/fatura DESTE mês.
        return mes_calendario
    # Antes da virada: ainda pertence ao ciclo aberto no mês anterior.
    if data_transacao.month == 1:
        return date(data_transacao.year - 1, 12, 1)
    return date(data_transacao.year, data_transacao.month - 1, 1)


# ---------------------------------------------------------------------------
# Parcelamento -- detecção e projeção de parcelas futuras
# ---------------------------------------------------------------------------
# Marcador de parcela na descrição -- "(5/6)", "(12/12)", "(1/12)" (formato
# mais comum), "Parcela 5/6", "Parcela05/06" sem parênteses (ex: fatura Pan),
# ou "Parcela 6 de 12" por extenso (ex: fatura Dell/Mercado Pago via OCR) --
# sem reconhecer esse 3º formato, "DELL Parcela 6 de 12" e "DELL Parcela 7 de
# 12" viravam chaves DIFERENTES em tudo que depende deste regex (classificação
# por histórico, "repetir para todos", geração de parcelas futuras, dedup).
# Formatos por banco: "(5/6)" (Nubank/genérico), "Parcela 5/6"/"Parcela05/06"
# (Pan), "Parcela 6 de 12" (Dell/MP via OCR), "PARC 03/10"/"PARC. 3/10"
# (Itaú/Bradesco/Santander), "5/6 parcela"/"5 de 6" (variações).
_PADRAO_PARCELA = re.compile(
    r"\((?P<a1>\d{1,2})\s*/\s*(?P<t1>\d{1,2})\)"
    r"|parcela\s*(?P<a2>\d{1,2})\s*/\s*(?P<t2>\d{1,2})"
    r"|parcela\s*(?P<a3>\d{1,2})\s+de\s+(?P<t3>\d{1,2})"
    r"|parc\.?\s*(?P<a4>\d{1,2})\s*/\s*(?P<t4>\d{1,2})"
    r"|\b(?P<a5>\d{1,2})\s+de\s+(?P<t5>\d{1,2})\b",
    re.IGNORECASE,
)


def _detectar_parcela(descricao: str) -> tuple[int, int] | None:
    """Extrai (parcela_atual, parcela_total) de uma descrição parcelada, ou
    None se não for parcelada. Ignora casos degenerados (total < 2, atual fora
    do intervalo)."""
    m = _PADRAO_PARCELA.search(descricao)
    if not m:
        return None
    atual = int(m.group("a1") or m.group("a2") or m.group("a3") or m.group("a4") or m.group("a5"))
    total = int(m.group("t1") or m.group("t2") or m.group("t3") or m.group("t4") or m.group("t5"))
    if total < 2 or atual < 1 or atual > total:
        return None
    return atual, total


def _estabelecimento(descricao: str) -> str:
    """Parte estável da descrição pra identificar o mesmo parcelamento entre
    a projeção e a parcela real (que pode vir com prefixo diferente, ex:
    'COMPRA NO PAR' vs 'COMPRA NO PARCELADO'). Usa o texto após a última '/'
    quando existe (o nome do estabelecimento), senão a descrição sem o
    marcador de parcela."""
    sem_parcela = _PADRAO_PARCELA.sub("", descricao)
    if "/" in sem_parcela:
        return sem_parcela.rsplit("/", 1)[-1].strip().lower()
    return sem_parcela.strip().lower()


def _hash_parcela(conta_id: uuid.UUID, estabelecimento: str, total: int, valor: float, numero: int) -> str:
    base = f"{conta_id}|{estabelecimento}|{total}|{abs(valor):.2f}|{numero}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def _somar_meses(d: date, meses: int) -> date:
    """Soma `meses` a uma data, mantendo o dia (limitado ao último dia do mês
    de destino, ex: 31/01 + 1 mês -> 28/02)."""
    total = d.month - 1 + meses
    ano = d.year + total // 12
    mes = total % 12 + 1
    ultimo_dia = [31, 29 if ano % 4 == 0 and (ano % 100 != 0 or ano % 400 == 0) else 28,
                  31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]
    return date(ano, mes, min(d.day, ultimo_dia))


def excluir_parcelas_futuras_orfas(db: Session, transacoes_removidas: list[Transacao]) -> int:
    """Ao excluir lançamento(s) parcelado(s) -- um único ou uma importação
    inteira --, remove junto as parcelas FUTURAS (previsto=True) que ele(s)
    geraram via projetar_parcelas_de_origem. Necessário porque essas parcelas
    projetadas NUNCA recebem importacao_id (são criadas soltas, só ligadas ao
    hash_parcela) -- sem isso, sobreviveriam órfãs a qualquer exclusão,
    inflando meses futuros com gastos fantasmas.

    hash_parcela é ÚNICO POR NÚMERO de parcela (o número entra no hash), não
    um id compartilhado do parcelamento inteiro -- por isso recalcula o hash de
    TODAS as parcelas 1..parcela_total (mesma fórmula de projetar_parcelas_de_
    origem) pra achar as irmãs, em vez de comparar só o hash da que está sendo
    removida."""
    hashes = set()
    for t in transacoes_removidas:
        if not t.parcela_total or not t.hash_parcela:
            continue
        estab = _estabelecimento(t.descricao)
        valor = float(t.valor)
        for numero in range(1, t.parcela_total + 1):
            hashes.add(_hash_parcela(t.conta_conectada_id, estab, t.parcela_total, valor, numero))
    if not hashes:
        return 0
    ids_removidos = {t.id for t in transacoes_removidas}
    orfas = db.scalars(
        select(Transacao).where(
            Transacao.hash_parcela.in_(hashes),
            Transacao.previsto.is_(True),
            Transacao.id.not_in(ids_removidos),
        )
    ).all()
    for o in orfas:
        db.delete(o)
    return len(orfas)


def projetar_parcelas_de_origem(db: Session, origem: Transacao, modo_visualizacao: str) -> int:
    """Gera as parcelas futuras (previsto=True) de UMA compra parcelada real
    (origem com parcela_atual < parcela_total). Idempotente pelo hash_parcela.
    Reaproveitado pela importação de arquivo e pelo lançamento manual."""
    if not origem.parcela_total or origem.parcela_atual >= origem.parcela_total:
        return 0
    conta = db.get(ContaConectada, origem.conta_conectada_id)
    estab = _estabelecimento(origem.descricao)
    valor = float(origem.valor)
    criadas = 0
    for numero in range(origem.parcela_atual + 1, origem.parcela_total + 1):
        hp = _hash_parcela(conta.id, estab, origem.parcela_total, valor, numero)
        ja_existe = db.scalar(
            select(Transacao.id).where(
                Transacao.conta_conectada_id == conta.id, Transacao.hash_parcela == hp
            )
        )
        if ja_existe:
            continue
        data_proj = _somar_meses(origem.data, numero - origem.parcela_atual)
        desc_proj = _PADRAO_PARCELA.sub(f"({numero}/{origem.parcela_total})", origem.descricao)
        mes_ref = _calcular_mes_referencia(data_proj, conta.natureza, conta.dia_virada, modo_visualizacao)
        db.add(
            Transacao(
                conta_conectada_id=conta.id,
                cliente_id=origem.cliente_id,
                profissional_id=origem.profissional_id,
                data=data_proj,
                descricao=desc_proj,
                valor=origem.valor,
                tipo=origem.tipo,
                origem=origem.origem,
                contexto=origem.contexto,
                categoria_id=origem.categoria_id,
                subcategoria_id=origem.subcategoria_id,
                parcela_atual=numero,
                parcela_total=origem.parcela_total,
                previsto=True,
                hash_parcela=hp,
                hash_dedup=calcular_hash_dedup(conta.id, data_proj, valor, desc_proj),
                mes_referencia=mes_ref,
            )
        )
        criadas += 1
    db.flush()
    return criadas


def gerar_parcelas_futuras(db: Session, importacao_id: uuid.UUID, cliente_id: uuid.UUID) -> int:
    """Cria as parcelas futuras (previsto=True) das compras parceladas de uma
    importação. Idempotente: pula qualquer parcela que já exista (real ou
    prevista) pelo hash_parcela, então re-chamar ou re-importar não duplica.
    Retorna quantas parcelas foram criadas."""
    origens = db.scalars(
        select(Transacao).where(
            Transacao.importacao_id == importacao_id,
            Transacao.previsto.is_(False),
            Transacao.parcela_total.is_not(None),
            Transacao.parcela_atual < Transacao.parcela_total,
        )
    ).all()
    if not origens:
        return 0
    preferencia = db.get(PreferenciaCliente, cliente_id)
    modo_visualizacao = preferencia.visualizacao_lancamento if preferencia else "data_compra"
    return sum(projetar_parcelas_de_origem(db, origem, modo_visualizacao) for origem in origens)


# Prefixos genéricos das faturas ("COMPRA/", "COMPRA NO PARCELADO/") que não
# ajudam a identificar o estabelecimento -- removidos pra casar a mesma loja
# entre importações diferentes.
_PREFIXO_COMPRA = re.compile(r"^\s*compra(\s+no\s+par(?:celado)?)?\s*[:/-]*\s*", re.IGNORECASE)

# --- Limpeza de transferências de EXTRATO (Pix/TED/DOC) -------------------
# Numa transferência a descrição vem cheia de ruído que ATRAPALHA a
# classificação: CPF/CNPJ (mascarado ou não), banco de DESTINO, agência e conta
# do favorecido. O único token útil é o NOME de quem recebeu/enviou. Pior: o
# banco de destino ("PAGSEGURO", "MERCADO PAGO IP", "NU PAGAMENTOS") fazia a
# regra de "Meios de pagamento" disparar ERRADO (é o banco da pessoa, não uma
# maquininha). Ex: "Transferência enviada pelo Pix - Idelina ... - •••.613.646-••
# - PAGSEGURO INTERNET IP S.A. (0290) Agência: 1 Conta: 72575253-9" vira só
# "Transferência enviada pelo Pix - Idelina ...".
# Detecta que a linha é uma transferência/pagamento pessoa-a-pessoa em QUALQUER
# banco: Nubank ("Transferência enviada pelo Pix"), Itaú ("PIX TRANSF"/"PIX
# QRS"), Bradesco/Santander ("PIX ENVIADO"/"PIX RECEBIDO"), BB ("Pix - Enviado"),
# Caixa ("ENVIO PIX"/"RECEB PIX"), Inter/C6 ("Pix enviado para"), PicPay
# ("Pagamento para"/"Transferência para"), TED/DOC.
_EH_TRANSFERENCIA = re.compile(
    r"transfer[êe]ncia|\bpix\b|\bted\b|\bdoc\b|pagamento\s+para", re.IGNORECASE
)

# Instituições financeiras / de pagamento (banco de DESTINO do favorecido). Num
# extrato elas aparecem como ruído no fim da transferência -- e faziam a regra
# de "Meios de pagamento" disparar errado. Lista dos bancos/PIs mais usados no
# Brasil; casada como sufixo pra ser removida.
_INSTITUICOES = (
    r"nu\s*pagamentos|nubank|mercado\s*pago|mercadopago|pag\s*seguro|pagseguro|pagbank|"
    r"banco\s*inter|bco\s*inter|\binter\b|ita[uú](\s*unibanco)?|bradesco|"
    r"santander|banco\s*do\s*brasil|bco\s*do\s*brasil|caixa\s*econ[oô]mica|"
    r"banco\s*pan|bco\s*pan|\bc6\b|c6\s*bank|picpay|banco\s*original|\bneon\b|"
    r"\bnext\b|\bwill\b|sicoob|sicredi|\bsafra\b|\bbmg\b|daycoval|\bbs2\b|"
    r"votorantim|\bame\b|recargapay|\bstone\b|\bcielo\b|getnet|adyen|\bcora\b|"
    r"\bbtg\b|\bmodal\b|\binfinitepay\b|efi\b|gerencianet|\bpicpay\b"
)
# Marcadores de onde começa o ruído numa transferência (o NOME vem ANTES):
#  - CPF/CNPJ (mascarado ou não): •••.532.447-•• / 13.427.325/0001-05
#  - "Agência" / "Conta:" (dados bancários do favorecido)
#  - sufixo corporativo/instituição financeira (IP, S.A., LTDA, banco de destino)
#  - código bancário entre parênteses: (0260)
_RUIDO_TRANSFER = re.compile(
    r"\S*\d{3}\.\d{3}[-/]\S+"
    r"|ag[êe]ncia"
    r"|conta\s*:"
    r"|\bip\s*(s\.?\s*a|ltda)?\b"
    r"|institui[çc][ãa]o\s*de\s*pagamento"
    r"|\(\d{3,4}\)"
    r"|-\s*(?:" + _INSTITUICOES + r")\b",
    re.IGNORECASE,
)
_CNPJ_PARCIAL = re.compile(r"\b\d{2}\.\d{3}\.\d{3}\b")  # "48.023.090 NOME" no começo
# Data colada/solta no fim (Itaú: "PIX TRANSF JOAO12/01"). Sem \b: pega a data
# grudada em letra ("SILVA12/01").
_DATA_COLADA = re.compile(r"\d{1,2}/\d{1,2}(/\d{2,4})?\s*$")
# Instituição no FIM sem hífen (Bradesco: "...JOSE ALVES NU PAGAMENTOS"), só
# quando seguida de sufixos corporativos até o fim -- não trunca nome no meio.
_INSTITUICAO_FIM = re.compile(
    r"[-\s]+(?:" + _INSTITUICOES + r")"
    r"(?:\s+(?:ip|s\.?\s*a\.?|ltda|institui[çc][ãa]o\s+de\s+pagamento|bank|pagamentos))*\.?\s*$",
    re.IGNORECASE,
)


def _limpar_transferencia(descricao: str) -> str:
    """Reduz a descrição de uma transferência ao essencial pra classificação:
    'Transferência ... - <NOME/FAVORECIDO>'. Cobre os formatos dos bancos mais
    comuns. Não-transferências passam intactas. Usada só nas rotinas de
    classificação (regras/IA/histórico) -- a descrição ARMAZENADA continua
    completa (a pessoa vê com quem foi a transação)."""
    d = descricao or ""
    if not _EH_TRANSFERENCIA.search(d):
        return d
    m = _RUIDO_TRANSFER.search(d)
    if m:
        d = d[: m.start()]
    d = _CNPJ_PARCIAL.sub(" ", d)
    d = re.sub(r"\(transfer[êe]ncia[^)]*\)", " ", d, flags=re.IGNORECASE)
    d = _INSTITUICAO_FIM.sub("", d)  # banco de destino no fim, sem hífen
    d = _DATA_COLADA.sub("", d)
    d = d.rstrip(" -–—\t")
    return re.sub(r"\s+", " ", d).strip() or (descricao or "")


def _chave_descricao(descricao: str) -> str:
    """Chave normalizada de uma descrição pra casar o MESMO estabelecimento
    entre lançamentos/importações: tira marcador de parcela, prefixo "COMPRA/"
    e pontuação. Ex: "COMPRA NO PARCELADO (4/6)/PAD NOVA PRIMAVERA" e
    "COMPRA/PAD NOVA PRIMAVERA" viram ambos "pad nova primavera". Transferências
    são reduzidas ao nome do favorecido -> todo Pix pra mesma pessoa cai na
    mesma chave (classificar um vale pros outros)."""
    d = _limpar_transferencia(descricao or "")
    d = _PADRAO_PARCELA.sub("", d)
    d = _PREFIXO_COMPRA.sub("", d)
    d = re.sub(r"[^0-9a-zA-Zà-úÀ-Ú ]", " ", d)
    return re.sub(r"\s+", " ", d).strip().lower()


def chave_cross_fonte(data, valor, tipo: str, descricao: str) -> str:
    """Chave pra detectar o MESMO lançamento vindo de fontes DIFERENTES (arquivo
    x Open Finance): data + valor + tipo + descrição normalizada. Conservadora
    -- só casa quando a descrição normaliza igual, então não junta dois gastos
    legítimos parecidos só por terem mesmo dia/valor."""
    return f"{data.isoformat()}|{abs(float(valor)):.2f}|{tipo}|{_chave_descricao(descricao)}"


def chaves_existentes_cliente(db: Session, cliente_id, contas_excluidas=()) -> set:
    """Conjunto de chaves cross-fonte dos lançamentos REAIS (não previstos) do
    cliente, ignorando as contas passadas (as que estão sendo escritas agora --
    a dedup DENTRO da mesma conta já é feita por hash_dedup). Uma query só."""
    q = select(Transacao.data, Transacao.valor, Transacao.tipo, Transacao.descricao).where(
        Transacao.cliente_id == cliente_id, Transacao.previsto.is_(False)
    )
    if contas_excluidas:
        q = q.where(Transacao.conta_conectada_id.notin_(list(contas_excluidas)))
    return {chave_cross_fonte(d, v, tp, desc) for d, v, tp, desc in db.execute(q)}


def aplicar_classificacao_por_regras(db: Session, txs: list) -> int:
    """Classificação INSTANTÂNEA por palavra-chave (sem IA), via as regras de
    negócio em app/integrations/regras_categoria.py (padaria->Mercado, ifood->
    Restaurantes, uber->Transporte, tarifa->Tarifas bancárias, juros/IOF->
    Impostos e taxas, Meta Ads->Marketing, etc.). Só toca saídas ainda sem
    categoria; nunca sobrescreve o que já tem."""
    alvo = [t for t in txs if t.categoria_id is None and t.tipo == "saida"]
    if not alvo:
        return 0
    categorias = db.scalars(select(Categoria).where(Categoria.cliente_id.is_(None))).all()
    subcategorias = db.scalars(select(Subcategoria).where(Subcategoria.cliente_id.is_(None))).all()
    cat_por_nome = {c.nome.strip().lower(): c for c in categorias}
    sub_por = {(s.categoria_id, s.nome.strip().lower()): s.id for s in subcategorias}
    n = 0
    for t in alvo:
        # Classifica pela descrição LIMPA -> evita o falso-positivo de "Meios
        # de pagamento" quando PagSeguro/Mercado Pago aparece como banco de
        # destino de um Pix (e não como maquininha).
        regra = classificar_por_regra(_limpar_transferencia(t.descricao))
        if not regra:
            continue
        cat_nome, sub_nome = regra
        cat = cat_por_nome.get(cat_nome.strip().lower())
        if not cat:
            continue
        sub_id = sub_por.get((cat.id, sub_nome.strip().lower()))
        res = db.execute(
            update(Transacao)
            .where(Transacao.id == t.id, Transacao.categoria_id.is_(None))
            .values(categoria_id=cat.id, subcategoria_id=sub_id)
        )
        n += res.rowcount or 0
    db.flush()
    return n


def aplicar_classificacao_creditos(db: Session, txs: list) -> int:
    """Crédito/estorno/devolução/reembolso é ajuste, não renda nem despesa ->
    'Classificação neutra' / 'Reembolsos' (fica fora do fluxo). Só toca entradas
    ainda sem categoria."""
    alvo = [
        t for t in txs
        if t.categoria_id is None and t.tipo == "entrada" and _PADRAO_CREDITO_FATURA.search(t.descricao or "")
    ]
    if not alvo:
        return 0
    cat = db.scalar(
        select(Categoria).where(Categoria.cliente_id.is_(None), Categoria.tipo == "neutra")
    )
    if not cat:
        return 0
    sub = db.scalar(
        select(Subcategoria).where(
            Subcategoria.categoria_id == cat.id, func.lower(Subcategoria.nome) == "reembolsos"
        )
    )
    n = 0
    for t in alvo:
        res = db.execute(
            update(Transacao)
            .where(Transacao.id == t.id, Transacao.categoria_id.is_(None))
            .values(categoria_id=cat.id, subcategoria_id=sub.id if sub else None)
        )
        n += res.rowcount or 0
    db.flush()
    return n


def aplicar_classificacao_renda(db: Session, txs: list) -> int:
    """Entradas de renda (salário, proventos, aposentadoria, pró-labore) ->
    'Renda' / 'Renda'. Só toca entradas ainda sem categoria."""
    alvo = [
        t for t in txs
        if t.categoria_id is None and t.tipo == "entrada" and _PADRAO_RENDA.search(t.descricao or "")
    ]
    if not alvo:
        return 0
    cat = db.scalar(
        select(Categoria).where(Categoria.cliente_id.is_(None), Categoria.tipo == "entrada")
    )
    if not cat:
        return 0
    sub = db.scalar(
        select(Subcategoria).where(
            Subcategoria.categoria_id == cat.id, func.lower(Subcategoria.nome) == "renda"
        )
    )
    n = 0
    for t in alvo:
        res = db.execute(
            update(Transacao)
            .where(Transacao.id == t.id, Transacao.categoria_id.is_(None))
            .values(categoria_id=cat.id, subcategoria_id=sub.id if sub else None)
        )
        n += res.rowcount or 0
    db.flush()
    return n


def aplicar_classificacao_por_historico(db: Session, cliente_id: uuid.UUID, txs: list) -> int:
    """Classificação INSTANTÂNEA (sem IA): reaproveita a categoria que o próprio
    cliente já usou pra descrições do mesmo estabelecimento. Cobre a maior parte
    de uma fatura (comércios recorrentes) na hora do upload, deixando pra IA só
    o que é realmente novo. Só toca lançamentos ainda sem categoria; nunca
    sobrescreve o que já tem."""
    alvo = [t for t in txs if t.categoria_id is None]
    if not alvo:
        return 0
    historico = db.scalars(
        select(Transacao)
        .where(Transacao.cliente_id == cliente_id, Transacao.categoria_id.is_not(None))
        .order_by(Transacao.atualizado_em.desc())  # classificação/edição mais RECENTE vence
    ).all()
    mapa: dict[str, tuple] = {}
    for t in historico:
        k = _chave_descricao(t.descricao)
        if k and k not in mapa:
            mapa[k] = (t.categoria_id, t.subcategoria_id)
    n = 0
    for t in alvo:
        hit = mapa.get(_chave_descricao(t.descricao))
        if not hit:
            continue
        res = db.execute(
            update(Transacao)
            .where(Transacao.id == t.id, Transacao.categoria_id.is_(None))
            .values(categoria_id=hit[0], subcategoria_id=hit[1])
        )
        n += res.rowcount or 0
    db.flush()
    return n


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
    contexto: str = "PF",  # PF | PJ — em qual contexto os lançamentos entram
    mes_referencia_manual: date | None = None,  # se informado, força o mês de ref. de TODOS os lançamentos
    forcar: bool = False,  # ignora o aviso de "arquivo já importado" e importa mesmo assim
) -> ImportacaoExtrato:
    if contexto not in ("PF", "PJ"):
        raise HTTPException(status_code=422, detail="contexto inválido (use PF ou PJ)")
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

    # Dedup por ARQUIVO: se ESTE mesmo arquivo (byte a byte) já foi importado com
    # sucesso pra este cliente, avisa e pede confirmação (não bloqueia). Isso
    # pega a reimportação da mesma fatura -- inclusive por OCR, onde o dedup por
    # transação falha porque a leitura varia a cada vez. `forcar=True` prossegue.
    arquivo_hash = hashlib.sha256(conteudo).hexdigest()
    if not forcar:
        ja = db.scalar(
            select(ImportacaoExtrato)
            .where(
                ImportacaoExtrato.cliente_id == cliente_id,
                ImportacaoExtrato.arquivo_hash == arquivo_hash,
                ImportacaoExtrato.status == "processado",
            )
            .order_by(ImportacaoExtrato.criado_em.desc())
        )
        if ja is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "codigo": "arquivo_ja_importado",
                    "mensagem": (
                        f"Este arquivo já foi importado em {ja.criado_em.strftime('%d/%m/%Y')} "
                        f"({ja.transacoes_importadas} lançamentos). Importar de novo pode duplicar. "
                        "Deseja importar mesmo assim?"
                    ),
                },
            )

    # Fatura de cartão exige o cartão escolhido -- é o que faz os gastos abaterem
    # do limite. Sem isso os lançamentos iam pra uma conta genérica e o limite
    # nunca refletia. (Extrato de conta continua opcional.)
    if tipo_documento == "fatura_cartao":
        conta_sel = db.get(ContaConectada, conta_conectada_id) if conta_conectada_id else None
        if conta_sel is None or conta_sel.cliente_id != cliente_id or conta_sel.natureza != "cartao":
            raise HTTPException(
                status_code=422,
                detail="Selecione o cartão desta fatura (cadastre o cartão na aba Contas, se ainda não tiver).",
            )

    conta = _obter_conta_do_upload(db, cliente_id, profissional_id, conta_conectada_id)
    caminho_storage = upload_arquivo(conteudo, nome_arquivo, profissional_id)

    importacao = ImportacaoExtrato(
        conta_conectada_id=conta.id,
        cliente_id=cliente_id,
        profissional_id=profissional_id,
        tipo_documento=tipo_documento,
        formato_arquivo=extensao,
        arquivo_url=caminho_storage,
        arquivo_hash=arquivo_hash,
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

    # Trava de sanidade central + descarte de linhas de resumo/total (ver
    # _transacao_valida e _e_linha_agregada) -- nenhum lançamento sem descrição,
    # sem data ou de valor zero passa daqui, venha de qual parser vier.
    transacoes_parseadas = [
        t for t in transacoes_parseadas if _transacao_valida(t) and not _e_linha_agregada(t["descricao"])
    ]

    # Alguns PDFs (ex: certas faturas do Mercado Pago) usam fontes com ToUnicode
    # quebrado -- a extração de texto vira lixo embaralhado ("$z", "9uros do
    # mDs", caracteres �) e NÃO há como recuperar o texto por bibliotecas. Nesse
    # caso: se o OCR estiver configurado, "lê os pixels" da página como fallback;
    # senão, recusa a importação com mensagem clara (nunca importa lixo).
    recuperado_por_ocr = False
    if transacoes_parseadas:
        ilegiveis = sum(1 for t in transacoes_parseadas if _descricao_ilegivel(t["descricao"]))
        if ilegiveis / len(transacoes_parseadas) >= 0.4:
            recuperado = None
            if extensao == "pdf" and ocr_disponivel():
                try:
                    # OCR "lê os pixels" -> texto legível; a IA remonta as
                    # transações do texto (robusto a qualquer layout).
                    cand = extrair_transacoes_ocr(ocr_pdf(conteudo), tipo_documento)
                    cand = [t for t in cand if _transacao_valida(t) and not _e_linha_agregada(t["descricao"])]
                    if cand:
                        recuperado = cand
                except OcrIndisponivel:
                    recuperado = None
            if recuperado is not None:
                transacoes_parseadas = recuperado
                recuperado_por_ocr = True
            else:
                importacao.status = "erro"
                importacao.erro_detalhe = (
                    "Não conseguimos ler esta fatura automaticamente — o PDF usa uma fonte que "
                    "embaralha o texto na extração. Baixe a fatura de novo pelo app do banco/cartão "
                    "(de preferência em CSV ou OFX), ou envie o extrato da conta."
                )
                db.flush()
                db.refresh(importacao)
                return importacao

    # A IA do OCR já devolve o tipo certo (compra=saída, estorno=entrada), então
    # NÃO inverte quando os lançamentos vieram do OCR.
    if tipo_documento == "fatura_cartao" and not recuperado_por_ocr:
        # Os parsers assumem a convenção de extrato bancário (valor positivo
        # = entrada/crédito). Numa fatura de cartão é o oposto: cada linha
        # positiva é uma compra (gasto), e só um valor negativo no documento
        # (ex: um estorno) representa um crédito de volta -- por isso inverte
        # o tipo aqui em vez de nos parsers, que continuam genéricos.
        for t in transacoes_parseadas:
            t["tipo"] = "saida" if t["tipo"] == "entrada" else "entrada"
            # Crédito/estorno na fatura devolve dinheiro -- é entrada, não gasto.
            if _PADRAO_CREDITO_FATURA.search(t["descricao"]):
                t["tipo"] = "entrada"

    origem = "cartao" if tipo_documento == "fatura_cartao" else "conta"
    preferencia = db.get(PreferenciaCliente, cliente_id)
    modo_visualizacao = preferencia.visualizacao_lancamento if preferencia else "data_compra"
    # Mês de referência informado à mão na importação (ex: fatura cujas datas
    # de compra espalham por vários meses, mas que deve contar toda num mês só).
    mes_ref_forcado = mes_referencia_manual.replace(day=1) if mes_referencia_manual else None
    importadas = 0
    duplicadas = 0
    parcelamentos_detectados = 0  # compras parceladas c/ parcelas futuras a gerar
    inseridas = []  # [{"id", "descricao", "tipo"}] -- só as que entraram de fato (não duplicadas)
    # Dedup cross-fonte: chaves dos lançamentos que o cliente já tem em OUTRAS
    # contas (ex: importados por Open Finance) -- pra não duplicar o mesmo
    # lançamento vindo por arquivo. A dedup dentro desta conta é o hash_dedup.
    chaves_outras = chaves_existentes_cliente(db, cliente_id, contas_excluidas=[conta.id])
    for t in transacoes_parseadas:
        hash_dedup = calcular_hash_dedup(conta.id, t["data"], t["valor"], t["descricao"])
        ck = chave_cross_fonte(t["data"], t["valor"], t["tipo"], t["descricao"])
        if ck in chaves_outras:
            duplicadas += 1  # já existe em outra fonte/conta -> não duplica
            continue
        mes_referencia = mes_ref_forcado or _calcular_mes_referencia(
            t["data"], conta.natureza, conta.dia_virada, modo_visualizacao
        )

        parcela = _detectar_parcela(t["descricao"])
        parcela_atual = parcela_total = hash_parcela = None
        if parcela:
            parcela_atual, parcela_total = parcela
            hash_parcela = _hash_parcela(
                conta.id, _estabelecimento(t["descricao"]), parcela_total, t["valor"], parcela_atual
            )
            # Se essa parcela real já existia como projeção (previsto), remove a
            # projeção antes de inserir a real -- é o que evita duplicar quando a
            # fatura do mês seguinte chega com a parcela que a gente tinha previsto.
            db.execute(
                delete(Transacao).where(
                    Transacao.conta_conectada_id == conta.id,
                    Transacao.hash_parcela == hash_parcela,
                    Transacao.previsto.is_(True),
                )
            )
            if parcela_total > parcela_atual:
                parcelamentos_detectados += 1

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
                contexto=contexto,
                importacao_id=importacao.id,
                hash_dedup=hash_dedup,
                mes_referencia=mes_referencia,
                parcela_atual=parcela_atual,
                parcela_total=parcela_total,
                hash_parcela=hash_parcela,
            )
            .on_conflict_do_nothing(index_elements=["conta_conectada_id", "hash_dedup"])
            .returning(Transacao.id)
        )
        resultado = db.execute(stmt)
        linha = resultado.first()
        if linha:
            importadas += 1
            inseridas.append({"id": linha[0], "descricao": t["descricao"], "tipo": t["tipo"]})
            chaves_outras.add(ck)
        else:
            duplicadas += 1

    # Classificação INSTANTÂNEA por histórico (sem IA), aqui mesmo no upload:
    # reaproveita categorias que o cliente já usou pros mesmos estabelecimentos,
    # então a maior parte dos lançamentos já aparece classificada de cara. É
    # barato (uma query + memória), não chama rede -- não há risco de 504.
    if inseridas:
        novas = db.scalars(
            select(Transacao).where(Transacao.id.in_([i["id"] for i in inseridas]))
        ).all()
        aplicar_classificacao_creditos(db, novas)  # crédito/estorno -> neutra/Reembolsos
        aplicar_classificacao_renda(db, novas)  # salário/proventos -> Renda
        # Histórico ANTES das regras genéricas: uma correção manual do cliente
        # pra uma descrição (ex: reclassificar "PADARIA X" de Mercado pra outra
        # categoria) precisa vencer a regra de palavra-chave nas próximas
        # importações -- senão a regra sempre chegava primeiro e a correção
        # manual nunca "pegava" pros lançamentos futuros dessa descrição.
        aplicar_classificacao_por_historico(db, cliente_id, novas)  # reuso do histórico do cliente
        aplicar_classificacao_por_regras(db, novas)  # taxas/impostos por palavra-chave

    # A classificação por IA (pros lançamentos que o histórico não cobriu) NÃO
    # roda aqui (era o que fazia o upload de PDFs pesados estourar o maxDuration
    # -> 504). Acontece numa 2ª etapa (POST .../importacoes/{id}/classificar),
    # chamada pelo frontend logo depois -- cada request com seu próprio
    # orçamento de tempo. O que sobrar sem categoria é classificado lá (ou à mão).
    importacao.status = "processado"
    importacao.transacoes_importadas = importadas
    importacao.transacoes_duplicadas = duplicadas
    importacao.processado_em = datetime.now(timezone.utc)
    db.flush()
    # Quantos lançamentos NOVOS ainda ficaram sem categoria depois da etapa
    # síncrona (histórico + regras) -- ou seja, quantos a IA de fato tem pra
    # classificar na 2ª etapa. O frontend só dispara a IA (e só mostra o aviso
    # "classificando") quando isto é > 0, pra não exibir o aviso à toa quando
    # não há nada a fazer (ex: reimport duplicado, ou tudo já classificado).
    sem_categoria = 0
    if inseridas:
        sem_categoria = db.scalar(
            select(func.count())
            .select_from(Transacao)
            .where(
                Transacao.id.in_([i["id"] for i in inseridas]),
                Transacao.categoria_id.is_(None),
                Transacao.previsto.is_(False),
            )
        ) or 0
    db.refresh(importacao)
    # Atributos transientes (não persistem) -- só pra resposta.
    importacao.parcelamentos_detectados = parcelamentos_detectados
    importacao.lido_por_ocr = recuperado_por_ocr
    importacao.transacoes_sem_categoria = sem_categoria
    return importacao


@router.post("/importacoes", response_model=ImportacaoResposta, status_code=status.HTTP_201_CREATED)
async def criar_importacao(
    cliente_id: uuid.UUID = Form(...),
    tipo_documento: str = Form(...),
    periodo_inicio: date | None = Form(None),
    periodo_fim: date | None = Form(None),
    senha_pdf: str | None = Form(None),
    conta_conectada_id: uuid.UUID | None = Form(None),
    contexto: str = Form("PF"),
    forcar: bool = Form(False),
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
        senha_pdf=senha_pdf or None, conta_conectada_id=conta_conectada_id, contexto=contexto,
        forcar=forcar,
    )


@router.post("/importacoes/{importacao_id}/gerar-parcelas")
def gerar_parcelas_importacao(importacao_id: uuid.UUID, db: Session = Depends(get_db_com_rls)):
    importacao = db.get(ImportacaoExtrato, importacao_id)
    if not importacao:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    criadas = gerar_parcelas_futuras(db, importacao_id, importacao.cliente_id)
    return {"parcelas_criadas": criadas}


@router.post("/importacoes/{importacao_id}/classificar")
def classificar_importacao_planejador(importacao_id: uuid.UUID, db: Session = Depends(get_db_com_rls)):
    """2ª etapa: classifica por IA os lançamentos da importação (RLS já garante
    que só importações do próprio planejador são encontradas)."""
    importacao = db.get(ImportacaoExtrato, importacao_id)
    if not importacao:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    return {"classificadas": classificar_importacao(db, importacao_id)}


def meses_ref_por_importacao(db: Session, importacao_ids: list[uuid.UUID]) -> dict:
    """Min/max do mes_referencia dos lançamentos de cada importação -- usado
    pra mostrar o mês de referência na lista de importações."""
    if not importacao_ids:
        return {}
    rows = db.execute(
        select(
            Transacao.importacao_id,
            func.min(Transacao.mes_referencia),
            func.max(Transacao.mes_referencia),
        )
        .where(Transacao.importacao_id.in_(importacao_ids))
        .group_by(Transacao.importacao_id)
    ).all()
    return {r[0]: (r[1], r[2]) for r in rows}


# Lotes da classificação por IA (ver aplicar_classificacao_ia): 20 itens por
# chamada respondem em poucos segundos; o orçamento de ~40s deixa folga dentro
# do maxDuration=60s da função mesmo se algum lote for lento.
_LOTE_IA = 20
_ORCAMENTO_IA_S = 40


def aplicar_classificacao_ia(db: Session, txs: list, sobrescrever: bool = False) -> int:
    """Classifica por IA uma lista de Transacao e aplica categoria/subcategoria.
    Best-effort: se a OpenAI falhar/estourar, retorna 0 e as transações seguem
    como estavam.

    sobrescrever=False (automático, 2ª etapa da importação): NUNCA mexe numa
    transação que já tenha categoria -- a aplicação é atômica no banco
    (UPDATE ... WHERE categoria_id IS NULL), então mesmo que o cliente
    classifique manualmente durante a janela da IA, o manual é preservado.
    sobrescrever=True (botão 'Reclassificar', pedido explícito): pode redefinir."""
    if not txs:
        return 0
    categorias = db.scalars(select(Categoria)).all()
    subcategorias = db.scalars(select(Subcategoria)).all()
    cat_por_nome = {c.nome.strip().lower(): c.id for c in categorias}
    sub_por_nome = {s.nome.strip().lower(): s.id for s in subcategorias}
    n = 0
    # Processa em LOTES pequenos em vez de uma chamada gigante: um extrato com
    # ~80 lançamentos numa única chamada estourava o timeout da OpenAI e
    # classificava ZERO. Em lotes, cada chamada volta rápida e o sucesso é
    # parcial (se um lote falha, os outros valem). Respeita um orçamento de
    # tempo pra caber no maxDuration=60s da função -- o que não der tempo fica
    # sem categoria e pode ser reprocessado no botão "Reclassificar".
    inicio = time.monotonic()
    for i in range(0, len(txs), _LOTE_IA):
        if time.monotonic() - inicio > _ORCAMENTO_IA_S:
            break
        lote = txs[i : i + _LOTE_IA]
        try:
            classificacoes = classificar_transacoes(
                [{"descricao": _limpar_transferencia(t.descricao), "tipo": t.tipo} for t in lote],
                categorias,
                subcategorias,
            )
        except ClassificacaoIndisponivel:
            continue  # best-effort: pula este lote, tenta os próximos
        for t, classif in zip(lote, classificacoes):
            categoria_id = cat_por_nome.get((classif.get("categoria") or "").strip().lower())
            subcategoria_id = sub_por_nome.get((classif.get("subcategoria") or "").strip().lower())
            if not (categoria_id or subcategoria_id):
                continue
            stmt = update(Transacao).where(Transacao.id == t.id)
            if not sobrescrever:
                # só aplica se AINDA estiver sem categoria -- protege o manual
                # mesmo numa corrida (edição manual durante a classificação).
                stmt = stmt.where(Transacao.categoria_id.is_(None))
            res = db.execute(stmt.values(categoria_id=categoria_id, subcategoria_id=subcategoria_id))
            n += res.rowcount or 0
        db.flush()
    return n


def classificar_importacao(db: Session, importacao_id: uuid.UUID, cliente_id: uuid.UUID | None = None) -> int:
    """2ª etapa da importação: classifica os lançamentos AINDA SEM categoria
    (automático, nunca sobrescreve manual)."""
    q = select(Transacao).where(
        Transacao.importacao_id == importacao_id,
        Transacao.categoria_id.is_(None),
        Transacao.previsto.is_(False),
    )
    if cliente_id is not None:
        q = q.where(Transacao.cliente_id == cliente_id)
    return aplicar_classificacao_ia(db, db.scalars(q).all(), sobrescrever=False)


def reclassificar_por_ids(db: Session, ids: list, cliente_id: uuid.UUID | None = None) -> int:
    """Reclassifica por IA um conjunto de lançamentos (por id) -- botão
    'Reclassificar com IA' (pedido explícito): PODE redefinir categoria já
    existente. Ignora previstos."""
    if not ids:
        return 0
    q = select(Transacao).where(Transacao.id.in_(ids), Transacao.previsto.is_(False))
    if cliente_id is not None:
        q = q.where(Transacao.cliente_id == cliente_id)
    return aplicar_classificacao_ia(db, db.scalars(q).all(), sobrescrever=True)


def _monta_importacao_resposta(imp, conta, meses: dict) -> ImportacaoResposta:
    ini, fim = meses.get(imp.id, (None, None))
    return ImportacaoResposta.model_validate(imp).model_copy(
        update={
            "conta_natureza": conta.natureza if conta else None,
            "conta_nome": conta.nome_exibicao if conta else None,
            "mes_ref_inicio": ini,
            "mes_ref_fim": fim,
        }
    )


@router.get("/importacoes", response_model=list[ImportacaoResposta])
def listar_importacoes(cliente_id: uuid.UUID | None = None, db: Session = Depends(get_db_com_rls)):
    query = (
        select(ImportacaoExtrato, ContaConectada)
        .outerjoin(ContaConectada, ContaConectada.id == ImportacaoExtrato.conta_conectada_id)
        .order_by(ImportacaoExtrato.criado_em.desc())
    )
    if cliente_id:
        query = query.where(ImportacaoExtrato.cliente_id == cliente_id)
    linhas = db.execute(query).all()
    meses = meses_ref_por_importacao(db, [imp.id for imp, _ in linhas])
    return [_monta_importacao_resposta(imp, conta, meses) for imp, conta in linhas]


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
    qtd_removida += excluir_parcelas_futuras_orfas(db, transacoes)
    for t in transacoes:
        db.delete(t)

    try:
        excluir_arquivo(importacao.arquivo_url)
    except Exception:
        pass  # arquivo já pode ter sido removido; não bloqueia a exclusão do registro

    db.delete(importacao)
    db.flush()

    return {"transacoes_removidas": qtd_removida}


@router.post("/transacoes/reclassificar")
def reclassificar_transacoes_planejador(dados: ReclassificarRequest, db: Session = Depends(get_db_com_rls)):
    """Reclassifica por IA os lançamentos informados (RLS garante que só os do
    próprio planejador entram)."""
    return {"reclassificadas": reclassificar_por_ids(db, dados.ids)}


@router.get("/transacoes", response_model=list[TransacaoResposta])
def listar_transacoes(
    cliente_id: uuid.UUID,
    incluir_previstos: bool = False,
    db: Session = Depends(get_db_com_rls),
):
    q = select(Transacao).where(Transacao.cliente_id == cliente_id)
    if not incluir_previstos:
        q = q.where(Transacao.previsto.is_(False))
    transacoes = db.scalars(q.order_by(Transacao.data.desc())).all()
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
        # Mesma descrição NORMALIZADA (não exata) -- ver _chave_descricao --,
        # de qualquer data, passada ou futura/prevista.
        chave_alvo = _chave_descricao(transacao.descricao)
        candidatas = db.scalars(
            select(Transacao).where(Transacao.cliente_id == transacao.cliente_id, Transacao.id != transacao_id)
        ).all()
        outras = [o for o in candidatas if chave_alvo and _chave_descricao(o.descricao) == chave_alvo]
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
    excluir_parcelas_futuras_orfas(db, [transacao])
    db.delete(transacao)
