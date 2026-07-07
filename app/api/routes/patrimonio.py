"""
Fase 2 do app do cliente final: Metas (objetivos financeiros), Dívidas,
Investimentos, Patrimônio (agregado) e Simulações ("Meu Futuro" —
independência financeira). Mesmo padrão das demais rotas /clientes/eu: sem
policy de RLS por cliente_id nessas tabelas (só por profissional_id), então
usamos a conexão privilegiada (get_db_admin) com filtro explícito por
cliente_id vindo do token já validado.
"""

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_cliente_id_atual, get_db_admin
from app.models.cliente import Cliente
from app.models.patrimonio import Divida, Investimento, Meta, MetaAporte, Simulacao
from app.models.transacao import Transacao
from app.schemas.patrimonio import (
    TIPOS_DIVIDA,
    TIPOS_INVESTIMENTO,
    TIPOS_META,
    DividaAtualizar,
    DividaCriar,
    DividaResposta,
    InvestimentoAtualizar,
    InvestimentoCriar,
    InvestimentoResposta,
    MetaAporteCriar,
    MetaAporteResposta,
    MetaAtualizar,
    MetaCriar,
    MetaResposta,
    PatrimonioResposta,
    SimulacaoCriar,
    SimulacaoResposta,
)

router = APIRouter(prefix="/clientes/eu", tags=["patrimonio"])


def _exigir_cliente(db: Session, cliente_id: uuid.UUID) -> Cliente:
    cliente = db.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    return cliente


# ============================================================================
# Metas (objetivos financeiros)
# ============================================================================


@router.get("/metas", response_model=list[MetaResposta])
def listar_metas(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    return db.scalars(select(Meta).where(Meta.cliente_id == cliente_id).order_by(Meta.criado_em.desc())).all()


@router.post("/metas", response_model=MetaResposta, status_code=status.HTTP_201_CREATED)
def criar_meta(
    dados: MetaCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    if dados.tipo not in TIPOS_META:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    meta = Meta(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        titulo=dados.titulo,
        tipo=dados.tipo,
        valor_alvo=dados.valor_alvo,
        prazo=dados.prazo,
    )
    db.add(meta)
    db.flush()
    db.refresh(meta)
    return meta


@router.patch("/metas/{meta_id}", response_model=MetaResposta)
def atualizar_meta(
    meta_id: uuid.UUID,
    dados: MetaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    meta = db.get(Meta, meta_id)
    if meta is None or meta.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meta não encontrada")
    if dados.status is not None and dados.status not in {"em_andamento", "concluida", "pausada"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Status inválido")
    if dados.tipo is not None and dados.tipo not in TIPOS_META:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tipo inválido")

    for campo in ("titulo", "tipo", "valor_alvo", "prazo", "status"):
        valor = getattr(dados, campo)
        if valor is not None:
            setattr(meta, campo, valor)
    meta.atualizado_em = datetime.now(timezone.utc)
    db.flush()
    db.refresh(meta)
    return meta


@router.delete("/metas/{meta_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_meta(
    meta_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    meta = db.get(Meta, meta_id)
    if meta is None or meta.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meta não encontrada")
    db.delete(meta)


@router.post("/metas/{meta_id}/aportes", response_model=MetaAporteResposta, status_code=status.HTTP_201_CREATED)
def criar_aporte(
    meta_id: uuid.UUID,
    dados: MetaAporteCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    meta = db.get(Meta, meta_id)
    if meta is None or meta.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meta não encontrada")
    aporte = MetaAporte(
        meta_id=meta_id,
        profissional_id=meta.profissional_id,
        valor=dados.valor,
        data=dados.data or date.today(),
        origem="manual",
    )
    db.add(aporte)
    db.flush()
    # O trigger trg_atualizar_meta já soma o valor em metas.valor_atual -- só
    # precisamos devolver o aporte criado.
    db.refresh(aporte)
    return aporte


# ============================================================================
# Dívidas
# ============================================================================


@router.get("/dividas", response_model=list[DividaResposta])
def listar_dividas(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    return db.scalars(
        select(Divida).where(Divida.cliente_id == cliente_id).order_by(Divida.criado_em.desc())
    ).all()


@router.post("/dividas", response_model=DividaResposta, status_code=status.HTTP_201_CREATED)
def criar_divida(
    dados: DividaCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    if dados.tipo not in TIPOS_DIVIDA:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    divida = Divida(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        tipo=dados.tipo,
        credor=dados.credor,
        valor_total=dados.valor_total,
        valor_pago=dados.valor_pago,
        taxa_juros_mensal_pct=dados.taxa_juros_mensal_pct,
        parcelas_totais=dados.parcelas_totais,
        parcelas_pagas=dados.parcelas_pagas,
        data_inicio=dados.data_inicio,
        data_prevista_quitacao=dados.data_prevista_quitacao,
    )
    db.add(divida)
    db.flush()
    db.refresh(divida)
    return divida


@router.patch("/dividas/{divida_id}", response_model=DividaResposta)
def atualizar_divida(
    divida_id: uuid.UUID,
    dados: DividaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    divida = db.get(Divida, divida_id)
    if divida is None or divida.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dívida não encontrada")
    if dados.status is not None and dados.status not in {"ativa", "quitada", "atrasada"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Status inválido")

    for campo in ("credor", "valor_pago", "parcelas_pagas", "data_prevista_quitacao", "status"):
        valor = getattr(dados, campo)
        if valor is not None:
            setattr(divida, campo, valor)
    divida.atualizado_em = datetime.now(timezone.utc)
    db.flush()
    db.refresh(divida)
    return divida


@router.delete("/dividas/{divida_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_divida(
    divida_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    divida = db.get(Divida, divida_id)
    if divida is None or divida.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dívida não encontrada")
    db.delete(divida)


# ============================================================================
# Investimentos
# ============================================================================


@router.get("/investimentos", response_model=list[InvestimentoResposta])
def listar_investimentos(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)
):
    return db.scalars(
        select(Investimento)
        .where(Investimento.cliente_id == cliente_id)
        .order_by(Investimento.data_referencia.desc())
    ).all()


@router.post("/investimentos", response_model=InvestimentoResposta, status_code=status.HTTP_201_CREATED)
def criar_investimento(
    dados: InvestimentoCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    if dados.tipo not in TIPOS_INVESTIMENTO:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    investimento = Investimento(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        tipo=dados.tipo,
        nome_ativo=dados.nome_ativo,
        quantidade=dados.quantidade,
        valor_aplicado=dados.valor_aplicado,
        valor_atual=dados.valor_atual,
        data_referencia=dados.data_referencia or date.today(),
    )
    db.add(investimento)
    db.flush()
    db.refresh(investimento)
    return investimento


@router.patch("/investimentos/{investimento_id}", response_model=InvestimentoResposta)
def atualizar_investimento(
    investimento_id: uuid.UUID,
    dados: InvestimentoAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    investimento = db.get(Investimento, investimento_id)
    if investimento is None or investimento.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Investimento não encontrado")
    for campo in ("nome_ativo", "quantidade", "valor_aplicado", "valor_atual"):
        valor = getattr(dados, campo)
        if valor is not None:
            setattr(investimento, campo, valor)
    db.flush()
    db.refresh(investimento)
    return investimento


@router.delete("/investimentos/{investimento_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_investimento(
    investimento_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    investimento = db.get(Investimento, investimento_id)
    if investimento is None or investimento.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Investimento não encontrado")
    db.delete(investimento)


# ============================================================================
# Patrimônio (agregado)
# ============================================================================


@router.get("/patrimonio", response_model=PatrimonioResposta)
def obter_patrimonio(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    # Não há saldo de conta persistido -- "saldo" é a posição de caixa
    # acumulada desde o início dos lançamentos (entradas - saídas).
    entradas = db.scalar(
        select(func.coalesce(func.sum(Transacao.valor), 0)).where(
            Transacao.cliente_id == cliente_id, Transacao.tipo == "entrada"
        )
    )
    saidas = db.scalar(
        select(func.coalesce(func.sum(Transacao.valor), 0)).where(
            Transacao.cliente_id == cliente_id, Transacao.tipo == "saida"
        )
    )
    saldo_contas = float(entradas or 0) - float(abs(saidas or 0))

    total_investido = float(
        db.scalar(
            select(func.coalesce(func.sum(Investimento.valor_atual), 0)).where(
                Investimento.cliente_id == cliente_id
            )
        )
        or 0
    )
    total_dividas = float(
        db.scalar(
            select(func.coalesce(func.sum(Divida.valor_restante), 0)).where(
                Divida.cliente_id == cliente_id, Divida.status != "quitada"
            )
        )
        or 0
    )

    return PatrimonioResposta(
        saldo_contas=saldo_contas,
        total_investido=total_investido,
        total_dividas=total_dividas,
        patrimonio_liquido=saldo_contas + total_investido - total_dividas,
    )


# ============================================================================
# Simulações ("Meu Futuro" — independência financeira)
# ============================================================================


def _projetar_valor_final(patrimonio_inicial: float, aporte_mensal: float, taxa_anual_pct: float, prazo_anos: int) -> float:
    """FV = P(1+i)^n + PMT*(((1+i)^n - 1)/i), i = taxa mensal, n = meses.
    Fórmula documentada em schema_seguranca.sql (tabela simulacoes)."""
    i = (taxa_anual_pct / 100) / 12
    n = prazo_anos * 12
    if i == 0:
        return patrimonio_inicial + aporte_mensal * n
    fator = (1 + i) ** n
    return patrimonio_inicial * fator + aporte_mensal * ((fator - 1) / i)


@router.get("/simulacoes", response_model=list[SimulacaoResposta])
def listar_simulacoes(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)
):
    return db.scalars(
        select(Simulacao).where(Simulacao.cliente_id == cliente_id).order_by(Simulacao.criado_em.desc())
    ).all()


@router.post("/simulacoes", response_model=SimulacaoResposta, status_code=status.HTTP_201_CREATED)
def criar_simulacao(
    dados: SimulacaoCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    valor_final = _projetar_valor_final(
        dados.patrimonio_inicial, dados.aporte_mensal, dados.taxa_retorno_anual_pct, dados.prazo_anos
    )
    simulacao = Simulacao(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        nome_cenario=dados.nome_cenario,
        patrimonio_inicial=dados.patrimonio_inicial,
        aporte_mensal=dados.aporte_mensal,
        taxa_retorno_anual_pct=dados.taxa_retorno_anual_pct,
        prazo_anos=dados.prazo_anos,
        valor_final_projetado=valor_final,
        criado_por="cliente_final",
    )
    db.add(simulacao)
    db.flush()
    db.refresh(simulacao)
    return simulacao


@router.delete("/simulacoes/{simulacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_simulacao(
    simulacao_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    simulacao = db.get(Simulacao, simulacao_id)
    if simulacao is None or simulacao.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Simulação não encontrada")
    db.delete(simulacao)
