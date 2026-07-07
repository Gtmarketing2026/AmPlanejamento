"""
"Minhas Contas" do cliente final -- contas bancárias e cartões de crédito
nomeados (reaproveitando ContaConectada, ver natureza='conta'|'cartao').
Diferente da conta_conectada 'manual' única criada implicitamente pra
importações sem conta escolhida (ver
app/api/routes/importacoes.py::_obter_conta_do_upload), aqui o cliente
cadastra explicitamente cada conta/cartão que tem, edita saldo/limite
manualmente (sem Open Finance ainda) e associa as importações a elas.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_cliente_id_atual, get_db_admin, get_db_com_rls
from app.models.categoria import Categoria
from app.models.cliente import Cliente
from app.models.conta_conectada import ContaConectada
from app.models.preferencia_cliente import PreferenciaCliente
from app.models.transacao import Transacao
from app.schemas.conta import (
    NATUREZAS,
    ContaAtualizar,
    ContaCriar,
    ContaResposta,
    PreferenciaAtualizar,
    PreferenciaResposta,
)

router = APIRouter(prefix="/clientes/eu", tags=["contas"])
router_profissional = APIRouter(prefix="/clientes", tags=["contas"])


def _montar_resposta(conta: ContaConectada, valor_usado: float) -> ContaResposta:
    return ContaResposta.model_validate(conta).model_copy(update={"valor_usado": valor_usado})


@router_profissional.get("/{cliente_id}/contas", response_model=list[ContaResposta])
def listar_contas_do_cliente(
    cliente_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
):
    """Usado pelo profissional na tela de Importar extrato, pra escolher a
    qual conta/cartão do cliente associar o upload."""
    cliente = db.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    contas = db.scalars(
        select(ContaConectada)
        .where(ContaConectada.cliente_id == cliente_id, ContaConectada.nome_exibicao.is_not(None))
        .order_by(ContaConectada.natureza, ContaConectada.criado_em)
    ).all()
    return [_montar_resposta(c, 0.0) for c in contas]


def _mes_atual() -> date:
    hoje = date.today()
    return date(hoje.year, hoje.month, 1)


@router.get("/contas", response_model=list[ContaResposta])
def listar_minhas_contas(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    contas = db.scalars(
        select(ContaConectada)
        .where(ContaConectada.cliente_id == cliente_id)
        .order_by(ContaConectada.natureza, ContaConectada.criado_em)
    ).all()

    mes_atual = _mes_atual()
    neutras = select(Categoria.id).where(Categoria.tipo == "neutra")
    usados_por_conta = dict(
        db.execute(
            select(Transacao.conta_conectada_id, sa_func.sum(sa_func.abs(Transacao.valor)))
            .where(
                Transacao.cliente_id == cliente_id,
                Transacao.tipo == "saida",
                Transacao.previsto.is_(False),
                (Transacao.categoria_id.is_(None)) | (Transacao.categoria_id.not_in(neutras)),
                Transacao.mes_referencia == mes_atual,
            )
            .group_by(Transacao.conta_conectada_id)
        ).all()
    )
    return [_montar_resposta(c, float(usados_por_conta.get(c.id) or 0)) for c in contas]


@router.post("/contas", response_model=ContaResposta, status_code=status.HTTP_201_CREATED)
def criar_minha_conta(
    dados: ContaCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    if dados.natureza not in NATUREZAS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Natureza inválida: {dados.natureza}")
    if dados.dia_virada is not None and not (1 <= dados.dia_virada <= 31):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Dia de virada deve ser entre 1 e 31")

    cliente = db.get(Cliente, cliente_id)
    conta = ContaConectada(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        modo="manual",
        status="ativa",
        natureza=dados.natureza,
        nome_exibicao=dados.nome_exibicao,
        banco=dados.banco,
        saldo_manual=dados.saldo_manual,
        limite_total=dados.limite_total,
        dia_virada=dados.dia_virada,
    )
    db.add(conta)
    db.flush()
    db.refresh(conta)
    return _montar_resposta(conta, 0.0)


@router.patch("/contas/{conta_id}", response_model=ContaResposta)
def atualizar_minha_conta(
    conta_id: uuid.UUID,
    dados: ContaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    conta = db.get(ContaConectada, conta_id)
    if conta is None or conta.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta não encontrada")
    if dados.dia_virada is not None and not (1 <= dados.dia_virada <= 31):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Dia de virada deve ser entre 1 e 31")

    if dados.nome_exibicao is not None:
        conta.nome_exibicao = dados.nome_exibicao
    if dados.banco is not None:
        conta.banco = dados.banco
    if dados.saldo_manual is not None:
        conta.saldo_manual = dados.saldo_manual
    if dados.limite_total is not None:
        conta.limite_total = dados.limite_total
    if dados.dia_virada is not None:
        virada_mudou = conta.dia_virada != dados.dia_virada
        conta.dia_virada = dados.dia_virada
        if virada_mudou:
            _recalcular_mes_referencia_da_conta(db, conta)

    return _conta_para_resposta_agregada(db, conta)


@router.delete("/contas/{conta_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_minha_conta(
    conta_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    conta = db.get(ContaConectada, conta_id)
    if conta is None or conta.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta não encontrada")
    db.delete(conta)


def _conta_para_resposta_agregada(db: Session, conta: ContaConectada) -> ContaResposta:
    neutras = select(Categoria.id).where(Categoria.tipo == "neutra")
    valor_usado = db.scalar(
        select(sa_func.sum(sa_func.abs(Transacao.valor))).where(
            Transacao.conta_conectada_id == conta.id,
            Transacao.tipo == "saida",
            Transacao.previsto.is_(False),
            (Transacao.categoria_id.is_(None)) | (Transacao.categoria_id.not_in(neutras)),
            Transacao.mes_referencia == _mes_atual(),
        )
    )
    return _montar_resposta(conta, float(valor_usado or 0))


def _recalcular_mes_referencia_da_conta(db: Session, conta: ContaConectada) -> None:
    """Quando o dia de virada de um cartão muda, recalcula o mes_referencia
    de todos os lançamentos já importados desse cartão (senão ficariam
    inconsistentes com a nova regra)."""
    from app.api.routes.importacoes import _calcular_mes_referencia

    preferencia = db.get(PreferenciaCliente, conta.cliente_id)
    modo = preferencia.visualizacao_lancamento if preferencia else "data_compra"
    transacoes = db.scalars(select(Transacao).where(Transacao.conta_conectada_id == conta.id)).all()
    for t in transacoes:
        t.mes_referencia = _calcular_mes_referencia(t.data, conta.natureza, conta.dia_virada, modo)


# ============================================================================
# Preferências (visualização competência x virada de cartão)
# ============================================================================


@router.get("/preferencias", response_model=PreferenciaResposta)
def obter_minhas_preferencias(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    pref = db.get(PreferenciaCliente, cliente_id)
    if pref is None:
        return PreferenciaResposta(visualizacao_lancamento="data_compra")
    return pref


@router.patch("/preferencias", response_model=PreferenciaResposta)
def atualizar_minhas_preferencias(
    dados: PreferenciaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    if dados.visualizacao_lancamento not in {"data_compra", "virada_cartao"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Visualização inválida")

    cliente = db.get(Cliente, cliente_id)
    pref = db.get(PreferenciaCliente, cliente_id)
    if pref is None:
        pref = PreferenciaCliente(cliente_id=cliente_id, profissional_id=cliente.profissional_id)
        db.add(pref)
    pref.visualizacao_lancamento = dados.visualizacao_lancamento
    db.flush()

    # Preferência mudou -- recalcula mes_referencia de todos os lançamentos
    # de cartão do cliente pra refletir a nova regra imediatamente.
    from app.api.routes.importacoes import _calcular_mes_referencia

    cartoes = db.scalars(
        select(ContaConectada).where(
            ContaConectada.cliente_id == cliente_id, ContaConectada.natureza == "cartao"
        )
    ).all()
    contas_por_id = {c.id: c for c in cartoes}
    transacoes = db.scalars(
        select(Transacao).where(
            Transacao.cliente_id == cliente_id, Transacao.conta_conectada_id.in_(contas_por_id.keys())
        )
    ).all()
    for t in transacoes:
        conta = contas_por_id[t.conta_conectada_id]
        t.mes_referencia = _calcular_mes_referencia(t.data, conta.natureza, conta.dia_virada, dados.visualizacao_lancamento)

    return pref
