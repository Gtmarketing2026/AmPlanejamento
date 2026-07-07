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
from app.models.categoria import Categoria, Subcategoria
from app.models.cliente import Cliente
from app.models.patrimonio import (
    ApoliceSeguro,
    BemPatrimonial,
    Divida,
    Investimento,
    InvestimentoAlocacao,
    Meta,
    MetaAporte,
    OrcamentoCategoria,
    Simulacao,
)
from app.models.profissional import Profissional
from app.models.transacao import Transacao
from app.schemas.patrimonio import (
    PRIORIDADES_META,
    TIPOS_APOLICE,
    TIPOS_BEM,
    TIPOS_DIVIDA,
    TIPOS_INVESTIMENTO,
    TIPOS_META,
    AlocacaoResposta,
    ApoliceCriar,
    ApoliceResposta,
    BemCriar,
    BemResposta,
    DividaAtualizar,
    DividaCriar,
    DividaResposta,
    InvestimentoAtualizar,
    InvestimentoCriar,
    InvestimentoResposta,
    MensagemSaudeFinanceira,
    MetaAporteCriar,
    MetaAporteResposta,
    MetaAtualizar,
    MetaCriar,
    MetaResposta,
    MinhaProtecaoResposta,
    OrcamentoAtualizar,
    OrcamentoCriar,
    OrcamentoResposta,
    PatrimonioResposta,
    ResumoPatrimonialResposta,
    SaudeFinanceiraResposta,
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


def _valor_alocado_da_meta(db: Session, meta_id: uuid.UUID) -> float:
    return float(
        db.scalar(
            select(func.coalesce(func.sum(InvestimentoAlocacao.valor_alocado), 0)).where(
                InvestimentoAlocacao.meta_id == meta_id
            )
        )
        or 0
    )


def _meta_para_resposta(db: Session, meta: Meta) -> MetaResposta:
    resposta = MetaResposta.model_validate(meta)
    resposta.valor_investido_alocado = _valor_alocado_da_meta(db, meta.id)
    return resposta


@router.get("/metas", response_model=list[MetaResposta])
def listar_metas(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    metas = db.scalars(select(Meta).where(Meta.cliente_id == cliente_id).order_by(Meta.criado_em.desc())).all()
    return [_meta_para_resposta(db, m) for m in metas]


@router.post("/metas", response_model=MetaResposta, status_code=status.HTTP_201_CREATED)
def criar_meta(
    dados: MetaCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    if dados.tipo not in TIPOS_META:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    if dados.prioridade not in PRIORIDADES_META:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Prioridade inválida: {dados.prioridade}")
    meta = Meta(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        titulo=dados.titulo,
        tipo=dados.tipo,
        prioridade=dados.prioridade,
        valor_alvo=dados.valor_alvo,
        prazo=dados.prazo,
        aporte_mensal_meta=dados.aporte_mensal_meta,
    )
    db.add(meta)
    db.flush()
    db.refresh(meta)
    return _meta_para_resposta(db, meta)


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
    if dados.prioridade is not None and dados.prioridade not in PRIORIDADES_META:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Prioridade inválida")

    for campo in ("titulo", "tipo", "prioridade", "valor_alvo", "prazo", "status", "aporte_mensal_meta"):
        valor = getattr(dados, campo)
        if valor is not None:
            setattr(meta, campo, valor)
    meta.atualizado_em = datetime.now(timezone.utc)
    db.flush()
    db.refresh(meta)
    return _meta_para_resposta(db, meta)


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


def _investimento_para_resposta(db: Session, investimento: Investimento) -> InvestimentoResposta:
    linhas = db.execute(
        select(InvestimentoAlocacao, Meta.titulo)
        .join(Meta, Meta.id == InvestimentoAlocacao.meta_id)
        .where(InvestimentoAlocacao.investimento_id == investimento.id)
    ).all()
    resposta = InvestimentoResposta.model_validate(investimento)
    resposta.alocacoes = [
        AlocacaoResposta(id=a.id, meta_id=a.meta_id, meta_titulo=titulo, valor_alocado=a.valor_alocado)
        for a, titulo in linhas
    ]
    return resposta


def _aplicar_alocacoes(db: Session, investimento_id: uuid.UUID, cliente_id: uuid.UUID, profissional_id: uuid.UUID, alocacoes) -> None:
    """Substitui de uma vez a divisão do investimento entre objetivos --
    mais simples de raciocinar do que endpoints incrementais separados pra
    adicionar/remover cada alocação."""
    existentes = db.scalars(
        select(InvestimentoAlocacao).where(InvestimentoAlocacao.investimento_id == investimento_id)
    ).all()
    for e in existentes:
        db.delete(e)
    db.flush()

    for aloc in alocacoes:
        meta = db.get(Meta, aloc.meta_id)
        if meta is None or meta.cliente_id != cliente_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Meta {aloc.meta_id} não encontrada")
        db.add(
            InvestimentoAlocacao(
                investimento_id=investimento_id,
                meta_id=aloc.meta_id,
                cliente_id=cliente_id,
                profissional_id=profissional_id,
                valor_alocado=aloc.valor_alocado,
            )
        )
    db.flush()


@router.get("/investimentos", response_model=list[InvestimentoResposta])
def listar_investimentos(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)
):
    investimentos = db.scalars(
        select(Investimento)
        .where(Investimento.cliente_id == cliente_id)
        .order_by(Investimento.data_referencia.desc())
    ).all()
    return [_investimento_para_resposta(db, i) for i in investimentos]


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
        instituicao_nome=dados.instituicao_nome,
        liquidez=dados.liquidez,
    )
    db.add(investimento)
    db.flush()
    if dados.alocacoes:
        _aplicar_alocacoes(db, investimento.id, cliente_id, cliente.profissional_id, dados.alocacoes)
    db.refresh(investimento)
    return _investimento_para_resposta(db, investimento)


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
    for campo in ("nome_ativo", "quantidade", "valor_aplicado", "valor_atual", "instituicao_nome", "liquidez"):
        valor = getattr(dados, campo)
        if valor is not None:
            setattr(investimento, campo, valor)
    db.flush()
    if dados.alocacoes is not None:
        _aplicar_alocacoes(db, investimento.id, cliente_id, investimento.profissional_id, dados.alocacoes)
    db.refresh(investimento)
    return _investimento_para_resposta(db, investimento)


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


def _condicoes_fluxo_real():
    """Condições comuns pras somas de fluxo de caixa. Fora da conta:
    - parcelas previstas (previsto=True): ainda não caíram, não são posição real;
    - lançamentos de categoria neutra: movimentação financeira interna (ex:
      transferência entre contas próprias, aplicação/resgate) -- não é receita
      nem despesa de verdade, então não entra no fluxo. Ver categorias.tipo."""
    neutras = select(Categoria.id).where(Categoria.tipo == "neutra")
    return (
        Transacao.previsto.is_(False),
        (Transacao.categoria_id.is_(None)) | (Transacao.categoria_id.not_in(neutras)),
    )


def _calcular_patrimonio(db: Session, cliente_id: uuid.UUID) -> dict:
    # Não há saldo de conta persistido -- "saldo" é a posição de caixa
    # acumulada desde o início dos lançamentos (entradas - saídas).
    entradas = db.scalar(
        select(func.coalesce(func.sum(Transacao.valor), 0)).where(
            Transacao.cliente_id == cliente_id, Transacao.tipo == "entrada", *_condicoes_fluxo_real()
        )
    )
    saidas = db.scalar(
        select(func.coalesce(func.sum(Transacao.valor), 0)).where(
            Transacao.cliente_id == cliente_id, Transacao.tipo == "saida", *_condicoes_fluxo_real()
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
    total_bens = float(
        db.scalar(
            select(func.coalesce(func.sum(BemPatrimonial.valor), 0)).where(
                BemPatrimonial.cliente_id == cliente_id
            )
        )
        or 0
    )

    return {
        "saldo_contas": saldo_contas,
        "total_investido": total_investido,
        "total_bens": total_bens,
        "total_dividas": total_dividas,
        "patrimonio_liquido": saldo_contas + total_investido + total_bens - total_dividas,
    }


@router.get("/patrimonio", response_model=PatrimonioResposta)
def obter_patrimonio(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    return PatrimonioResposta(**_calcular_patrimonio(db, cliente_id))


@router.get("/patrimonio/resumo", response_model=ResumoPatrimonialResposta)
def obter_resumo_patrimonial(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)
):
    """Visão em fatias pro Resumo Patrimonial (donuts de Ativos/Passivos +
    indicador de quanto do patrimônio está "trabalhando" -- investido, e não
    parado em conta ou em bens de uso pessoal)."""
    p = _calcular_patrimonio(db, cliente_id)
    total_ativos = max(0.0, p["saldo_contas"]) + p["total_investido"] + p["total_bens"]
    pct_gerador_renda = (p["total_investido"] / total_ativos * 100) if total_ativos > 0 else 0.0

    return ResumoPatrimonialResposta(
        ativos_liquidez=max(0.0, p["saldo_contas"]),
        ativos_investimentos=p["total_investido"],
        ativos_bens=p["total_bens"],
        passivos_dividas=p["total_dividas"],
        patrimonio_liquido=p["patrimonio_liquido"],
        pct_ativo_gerador_renda=round(pct_gerador_renda, 1),
    )


# ============================================================================
# Saúde financeira (termômetro + alertas do mês)
# ============================================================================


@router.get("/saude-financeira", response_model=SaudeFinanceiraResposta)
def obter_saude_financeira(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)
):
    """Diagnóstico rápido do mês corrente pro cliente ver logo de cara: quanto
    ganhou x gastou, e quanto das despesas está comprometido com dívidas.
    Regras simples e determinísticas (sem IA) -- os dois alertas de exemplo
    são só aritmética, não precisam de um modelo de linguagem pra soar
    relevantes; mais barato, instantâneo e sempre consistente."""
    hoje = date.today()
    inicio_mes = hoje.replace(day=1)

    entradas_mes = float(
        db.scalar(
            select(func.coalesce(func.sum(Transacao.valor), 0)).where(
                Transacao.cliente_id == cliente_id, Transacao.tipo == "entrada",
                Transacao.data >= inicio_mes, *_condicoes_fluxo_real()
            )
        )
        or 0
    )
    despesas_mes = float(
        abs(
            db.scalar(
                select(func.coalesce(func.sum(Transacao.valor), 0)).where(
                    Transacao.cliente_id == cliente_id, Transacao.tipo == "saida",
                    Transacao.data >= inicio_mes, *_condicoes_fluxo_real()
                )
            )
            or 0
        )
    )

    # Parcela mensal estimada de cada dívida ativa: valor_total/parcelas_totais
    # quando informado, senão aproxima por valor_restante/12 (amortização
    # genérica de 1 ano) -- é só uma estimativa pro alerta, não um cálculo
    # financeiro exato de amortização.
    dividas_ativas = db.scalars(
        select(Divida).where(Divida.cliente_id == cliente_id, Divida.status != "quitada")
    ).all()
    parcela_mensal_dividas = 0.0
    for d in dividas_ativas:
        if d.parcelas_totais:
            parcela_mensal_dividas += float(d.valor_total) / d.parcelas_totais
        else:
            parcela_mensal_dividas += float(d.valor_restante) / 12

    tem_dados = entradas_mes > 0 or despesas_mes > 0
    mensagens: list[MensagemSaudeFinanceira] = []
    gasto_acima_renda_pct = None
    comprometimento_dividas_pct = None

    if not tem_dados:
        score = 50
    else:
        poupanca_pct = ((entradas_mes - despesas_mes) / entradas_mes * 100) if entradas_mes > 0 else -100.0
        score = max(0, min(100, round(50 + poupanca_pct)))

        if despesas_mes > entradas_mes and entradas_mes > 0:
            gasto_acima_renda_pct = round((despesas_mes - entradas_mes) / entradas_mes * 100, 2)
            mensagens.append(
                MensagemSaudeFinanceira(
                    tipo="alerta",
                    texto=(
                        f"Cuidado! Você está gastando {gasto_acima_renda_pct}% a mais do que você ganha. "
                        "Revise seu orçamento e metas de gasto ou peça auxílio para o seu planejador!"
                    ),
                )
            )

        if despesas_mes > 0 and parcela_mensal_dividas > 0:
            comprometimento_dividas_pct = round(min(100, parcela_mensal_dividas / despesas_mes * 100), 2)
            if comprometimento_dividas_pct >= 20:
                score = max(0, score - 15)
                mensagens.append(
                    MensagemSaudeFinanceira(
                        tipo="alerta",
                        texto=(
                            f"Cuidado! Suas dívidas e financiamentos estão comprometendo "
                            f"{comprometimento_dividas_pct}% das suas despesas. Revise o seu orçamento ou "
                            "fale com o seu planejador para lhe auxiliar na solução!"
                        ),
                    )
                )

        if not mensagens:
            mensagens.append(
                MensagemSaudeFinanceira(
                    tipo="positivo",
                    texto=f"Parabéns! Você está economizando {round(max(0, 100 - (despesas_mes / entradas_mes * 100 if entradas_mes else 0)), 1)}% da sua renda este mês.",
                )
            )

    cliente = db.get(Cliente, cliente_id)
    profissional = db.get(Profissional, cliente.profissional_id) if cliente else None

    return SaudeFinanceiraResposta(
        tem_dados=tem_dados,
        score=score,
        receitas_mes=entradas_mes,
        despesas_mes=despesas_mes,
        gasto_acima_renda_pct=gasto_acima_renda_pct,
        comprometimento_dividas_pct=comprometimento_dividas_pct,
        mensagens=mensagens,
        planejador_whatsapp=profissional.whatsapp if profissional else None,
    )


# ============================================================================
# Bens patrimoniais (móveis/imóveis)
# ============================================================================


@router.get("/bens", response_model=list[BemResposta])
def listar_bens(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    return db.scalars(
        select(BemPatrimonial).where(BemPatrimonial.cliente_id == cliente_id).order_by(BemPatrimonial.criado_em.desc())
    ).all()


@router.post("/bens", response_model=BemResposta, status_code=status.HTTP_201_CREATED)
def criar_bem(
    dados: BemCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    if dados.tipo not in TIPOS_BEM:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    bem = BemPatrimonial(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        tipo=dados.tipo,
        nome=dados.nome,
        valor=dados.valor,
    )
    db.add(bem)
    db.flush()
    db.refresh(bem)
    return bem


@router.delete("/bens/{bem_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_bem(
    bem_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    bem = db.get(BemPatrimonial, bem_id)
    if bem is None or bem.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bem não encontrado")
    db.delete(bem)


# ============================================================================
# Orçamento por categoria
# ============================================================================


def _calcular_realizado(
    db: Session,
    cliente_id: uuid.UUID,
    categoria_id: uuid.UUID,
    ano: int,
    mes: int,
    subcategoria_id: uuid.UUID | None = None,
) -> float:
    condicoes = [
        Transacao.cliente_id == cliente_id,
        Transacao.categoria_id == categoria_id,
        Transacao.tipo == "saida",
        Transacao.previsto.is_(False),  # parcela prevista não é gasto realizado
        func.extract("year", Transacao.data) == ano,
        func.extract("month", Transacao.data) == mes,
    ]
    if subcategoria_id is not None:
        condicoes.append(Transacao.subcategoria_id == subcategoria_id)
    realizado = db.scalar(select(func.coalesce(func.sum(func.abs(Transacao.valor)), 0)).where(*condicoes))
    return float(realizado or 0)


def _orcamento_resposta(db: Session, orc: OrcamentoCategoria, categoria_nome: str | None, subcategoria_nome: str | None) -> OrcamentoResposta:
    return OrcamentoResposta(
        id=orc.id,
        categoria_id=orc.categoria_id,
        categoria_nome=categoria_nome,
        subcategoria_id=orc.subcategoria_id,
        subcategoria_nome=subcategoria_nome,
        ano=orc.ano,
        mes=orc.mes,
        valor_orcado=orc.valor_orcado,
        valor_realizado=_calcular_realizado(db, orc.cliente_id, orc.categoria_id, orc.ano, orc.mes, orc.subcategoria_id),
    )


@router.get("/orcamentos", response_model=list[OrcamentoResposta])
def listar_orcamentos(
    ano: int,
    mes: int,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    linhas = db.execute(
        select(OrcamentoCategoria, Categoria.nome, Subcategoria.nome)
        .join(Categoria, Categoria.id == OrcamentoCategoria.categoria_id)
        .outerjoin(Subcategoria, Subcategoria.id == OrcamentoCategoria.subcategoria_id)
        .where(OrcamentoCategoria.cliente_id == cliente_id, OrcamentoCategoria.ano == ano, OrcamentoCategoria.mes == mes)
    ).all()
    return [_orcamento_resposta(db, orc, cat_nome, sub_nome) for orc, cat_nome, sub_nome in linhas]


@router.post("/orcamentos", response_model=OrcamentoResposta, status_code=status.HTTP_201_CREATED)
def criar_orcamento(
    dados: OrcamentoCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    categoria = db.get(Categoria, dados.categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")

    subcategoria = None
    if dados.subcategoria_id is not None:
        subcategoria = db.get(Subcategoria, dados.subcategoria_id)
        if subcategoria is None or subcategoria.categoria_id != dados.categoria_id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Subcategoria inválida pra essa categoria")

    existente = db.scalar(
        select(OrcamentoCategoria).where(
            OrcamentoCategoria.cliente_id == cliente_id,
            OrcamentoCategoria.categoria_id == dados.categoria_id,
            OrcamentoCategoria.subcategoria_id == dados.subcategoria_id,
            OrcamentoCategoria.ano == dados.ano,
            OrcamentoCategoria.mes == dados.mes,
        )
    )
    if existente:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma meta igual (mesma categoria/subcategoria) neste mês.")

    orcamento = OrcamentoCategoria(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        categoria_id=dados.categoria_id,
        subcategoria_id=dados.subcategoria_id,
        ano=dados.ano,
        mes=dados.mes,
        valor_orcado=dados.valor_orcado,
    )
    db.add(orcamento)
    db.flush()
    db.refresh(orcamento)
    return _orcamento_resposta(db, orcamento, categoria.nome, subcategoria.nome if subcategoria else None)


@router.patch("/orcamentos/{orcamento_id}", response_model=OrcamentoResposta)
def atualizar_orcamento(
    orcamento_id: uuid.UUID,
    dados: OrcamentoAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    orcamento = db.get(OrcamentoCategoria, orcamento_id)
    if orcamento is None or orcamento.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Orçamento não encontrado")
    orcamento.valor_orcado = dados.valor_orcado
    orcamento.atualizado_em = datetime.now(timezone.utc)
    db.flush()
    db.refresh(orcamento)
    categoria = db.get(Categoria, orcamento.categoria_id)
    subcategoria = db.get(Subcategoria, orcamento.subcategoria_id) if orcamento.subcategoria_id else None
    return _orcamento_resposta(db, orcamento, categoria.nome if categoria else None, subcategoria.nome if subcategoria else None)


@router.delete("/orcamentos/{orcamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_orcamento(
    orcamento_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    orcamento = db.get(OrcamentoCategoria, orcamento_id)
    if orcamento is None or orcamento.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Orçamento não encontrado")
    db.delete(orcamento)


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


def _aporte_necessario(patrimonio_inicial: float, valor_alvo: float, taxa_anual_pct: float, prazo_anos: int) -> float:
    """Inverso de _projetar_valor_final: qual aporte mensal (PMT) leva o
    patrimônio inicial até o valor_alvo em prazo_anos, dado i? Resolve
    PMT = (FV - P*(1+i)^n) * i / ((1+i)^n - 1). Nunca negativo -- se o
    patrimônio já basta sozinho, o aporte necessário é 0."""
    i = (taxa_anual_pct / 100) / 12
    n = max(1, prazo_anos * 12)
    if i == 0:
        pmt = (valor_alvo - patrimonio_inicial) / n
    else:
        fator = (1 + i) ** n
        pmt = (valor_alvo - patrimonio_inicial * fator) * i / (fator - 1)
    return max(0.0, pmt)


def _patrimonio_necessario_aposentadoria(renda_desejada_mensal: float, outras_rendas_mensal: float, taxa_pos_pct: float) -> float:
    """Perpetuidade real: quanto patrimônio sustenta a renda mensal que falta
    (desejada - outras rendas) indefinidamente, sem consumir o principal,
    rendendo taxa_pos_pct ao ano (real) na fase de usufruto. PV = PMT / i."""
    renda_faltante = max(0.0, renda_desejada_mensal - outras_rendas_mensal)
    i_mensal = (taxa_pos_pct / 100) / 12
    if i_mensal <= 0:
        return renda_faltante * 12 * 100  # fallback improvável (taxa <= 0)
    return renda_faltante / i_mensal


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

    prazo_anos = dados.prazo_anos
    patrimonio_necessario = None
    aporte_necessario = None

    # Modo "independência financeira": tem idade atual/aposentadoria e renda
    # desejada -> calcula quanto patrimônio sustenta essa renda (perpetuidade)
    # e qual aporte mensal é necessário pra chegar lá.
    if dados.idade_atual is not None and dados.idade_aposentadoria is not None and dados.renda_desejada_mensal is not None:
        prazo_anos = max(1, dados.idade_aposentadoria - dados.idade_atual)
        patrimonio_necessario = _patrimonio_necessario_aposentadoria(
            dados.renda_desejada_mensal, dados.outras_rendas_mensal or 0, dados.taxa_pos_aposentadoria_pct
        )
        aporte_necessario = _aporte_necessario(
            dados.patrimonio_inicial, patrimonio_necessario, dados.taxa_retorno_anual_pct, prazo_anos
        )

    valor_final = _projetar_valor_final(
        dados.patrimonio_inicial, dados.aporte_mensal, dados.taxa_retorno_anual_pct, prazo_anos
    )
    simulacao = Simulacao(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        nome_cenario=dados.nome_cenario,
        patrimonio_inicial=dados.patrimonio_inicial,
        aporte_mensal=dados.aporte_mensal,
        taxa_retorno_anual_pct=dados.taxa_retorno_anual_pct,
        prazo_anos=prazo_anos,
        valor_final_projetado=valor_final,
        criado_por="cliente_final",
        idade_atual=dados.idade_atual,
        idade_aposentadoria=dados.idade_aposentadoria,
        renda_desejada_mensal=dados.renda_desejada_mensal,
        outras_rendas_mensal=dados.outras_rendas_mensal,
        taxa_pos_aposentadoria_pct=dados.taxa_pos_aposentadoria_pct,
        aporte_necessario=aporte_necessario,
        patrimonio_necessario=patrimonio_necessario,
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


# ============================================================================
# Minha Proteção (apólices de seguro)
# ============================================================================

# Regra de bolso pra sugerir cobertura de vida: múltiplo da renda mensal
# atual. É só uma estimativa de referência (mesmo espírito do disclaimer que
# já usamos em Meu Futuro) -- não substitui o cálculo detalhado que um
# planejador faria caso a caso.
MULTIPLICADOR_COBERTURA_RECOMENDADA = 60  # ~5 anos de renda mensal


@router.get("/protecao", response_model=MinhaProtecaoResposta)
def obter_minha_protecao(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)
):
    apolices = db.scalars(
        select(ApoliceSeguro).where(ApoliceSeguro.cliente_id == cliente_id).order_by(ApoliceSeguro.criado_em.desc())
    ).all()
    cobertura_atual = sum(float(a.valor_cobertura) for a in apolices if a.tipo == "vida")

    hoje = date.today()
    inicio_mes = hoje.replace(day=1)
    renda_mensal = float(
        db.scalar(
            select(func.coalesce(func.sum(Transacao.valor), 0)).where(
                Transacao.cliente_id == cliente_id, Transacao.tipo == "entrada",
                Transacao.data >= inicio_mes, *_condicoes_fluxo_real()
            )
        )
        or 0
    )
    cobertura_recomendada = renda_mensal * MULTIPLICADOR_COBERTURA_RECOMENDADA

    return MinhaProtecaoResposta(
        cobertura_atual=cobertura_atual,
        cobertura_recomendada=cobertura_recomendada,
        apolices=apolices,
    )


@router.post("/apolices", response_model=ApoliceResposta, status_code=status.HTTP_201_CREATED)
def criar_apolice(
    dados: ApoliceCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    if dados.tipo not in TIPOS_APOLICE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    apolice = ApoliceSeguro(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        tipo=dados.tipo,
        seguradora=dados.seguradora,
        valor_cobertura=dados.valor_cobertura,
        premio_mensal=dados.premio_mensal,
        vencimento=dados.vencimento,
    )
    db.add(apolice)
    db.flush()
    db.refresh(apolice)
    return apolice


@router.delete("/apolices/{apolice_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_apolice(
    apolice_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    apolice = db.get(ApoliceSeguro, apolice_id)
    if apolice is None or apolice.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Apólice não encontrada")
    db.delete(apolice)
