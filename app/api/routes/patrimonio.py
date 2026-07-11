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
from sqlalchemy import case, func, select
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
    Milha,
    OrcamentoCategoria,
    PlanoInvestimentoConfig,
    ProtecaoConfig,
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
    ApoliceAtualizar,
    ApoliceCriar,
    ApoliceResposta,
    BemAtualizar,
    BemCriar,
    BemResposta,
    CriteriosSaude,
    DimensaoIndice,
    DividaAtualizar,
    DividaCriar,
    DividaResposta,
    IndiceSaudeResposta,
    InvestimentoAtualizar,
    InvestimentoCriar,
    InvestimentoResposta,
    MensagemSaudeFinanceira,
    MetaAporteCriar,
    MetaAporteResposta,
    MetaAtualizar,
    MetaCriar,
    MetaResposta,
    MilhaAtualizar,
    MilhaCriar,
    MilhaResposta,
    MinhaProtecaoResposta,
    OrcamentoAtualizar,
    OrcamentoCriar,
    OrcamentoResposta,
    PatrimonioResposta,
    PlanoInvestimentoAtualizar,
    PlanoInvestimentoResposta,
    ProtecaoConfigAtualizar,
    ProtecaoConfigResposta,
    ProtecaoMediasResposta,
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
    # tipo aceita valores PERSONALIZADOS (texto livre) além dos conhecidos --
    # só normaliza/limita o tamanho pra não guardar lixo.
    tipo = (dados.tipo or "outro").strip()[:40] or "outro"
    if dados.prioridade not in PRIORIDADES_META:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Prioridade inválida: {dados.prioridade}")
    meta = Meta(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        titulo=dados.titulo,
        tipo=tipo,
        prioridade=dados.prioridade,
        valor_alvo=dados.valor_alvo,
        data_inicial=dados.data_inicial,
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
    if dados.prioridade is not None and dados.prioridade not in PRIORIDADES_META:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Prioridade inválida")
    if dados.tipo is not None:
        dados.tipo = dados.tipo.strip()[:40] or "outro"  # tipo personalizado (texto livre)

    for campo in ("titulo", "tipo", "prioridade", "valor_alvo", "data_inicial", "prazo", "status", "aporte_mensal_meta"):
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
        responsavel=dados.responsavel if dados.responsavel in ("titular", "conjuge", "ambos") else "titular",
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
    if dados.tipo is not None and dados.tipo not in TIPOS_DIVIDA:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")

    for campo, valor in dados.model_dump(exclude_unset=True).items():
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
        classe_ativo=dados.classe_ativo,
        nome_ativo=dados.nome_ativo,
        quantidade=dados.quantidade,
        valor_aplicado=dados.valor_aplicado,
        valor_atual=dados.valor_atual,
        data_referencia=dados.data_referencia or date.today(),
        instituicao_nome=dados.instituicao_nome,
        liquidez=dados.liquidez,
        data_vencimento=dados.data_vencimento,
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
    # exclude_unset: só mexe nos campos que o cliente realmente enviou -- mas
    # respeita null explícito (ex: ao alternar de "data de vencimento" pra
    # "liquidez", o front manda data_vencimento=null pra limpar o outro modo).
    atualizacoes = dados.model_dump(exclude_unset=True)
    atualizacoes.pop("alocacoes", None)
    for campo, valor in atualizacoes.items():
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
      nem despesa de verdade, então não entra no fluxo. Ver categorias.tipo.
    - lançamentos de categoria de investimento (tipo='investimento'): aplicar
      dinheiro é alocação de patrimônio, não despesa de consumo -- entra na aba
      Investimentos, não no fluxo de saídas."""
    fora_do_fluxo = select(Categoria.id).where(
        Categoria.tipo.in_(["neutra", "investimento"])
    )
    return (
        Transacao.previsto.is_(False),
        (Transacao.categoria_id.is_(None)) | (Transacao.categoria_id.not_in(fora_do_fluxo)),
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

    # Aportes classificados como investimento nos lançamentos: saem do caixa e
    # viram patrimônio investido (relabel; não muda o patrimônio total). Ficam
    # "editáveis" no sentido de que reclassificar o lançamento (tirar de
    # Investimentos) automaticamente os remove daqui.
    cats_investimento = select(Categoria.id).where(Categoria.tipo == "investimento")
    investido_lancamentos = float(
        db.scalar(
            select(func.coalesce(func.sum(func.abs(Transacao.valor)), 0)).where(
                Transacao.cliente_id == cliente_id,
                Transacao.tipo == "saida",
                Transacao.previsto.is_(False),
                Transacao.categoria_id.in_(cats_investimento),
            )
        )
        or 0
    )
    saldo_contas -= investido_lancamentos  # tira do caixa (dinheiro que foi aplicado)

    total_investido = float(
        db.scalar(
            select(func.coalesce(func.sum(Investimento.valor_atual), 0)).where(
                Investimento.cliente_id == cliente_id
            )
        )
        or 0
    ) + investido_lancamentos  # soma os aportes via lançamentos
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
    # Saldo devedor dos bens financiados (ex: carro/imóvel ainda em financiamento)
    # entra como passivo -- o bem soma o valor de mercado e abate o que se deve.
    bens_saldo_devedor = float(
        db.scalar(
            select(func.coalesce(func.sum(BemPatrimonial.saldo_devedor), 0)).where(
                BemPatrimonial.cliente_id == cliente_id
            )
        )
        or 0
    )
    total_dividas += bens_saldo_devedor

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


# Classificação de cor da saúde financeira. Regras determinísticas e
# transparentes (o cliente vê um disclaimer de como é calculado). Combina
# reserva de emergência (meses de gasto cobertos) + taxa de poupança do mês.
# Ver defaults documentados no disclaimer do SaudeFinanceiraCard (frontend).
def _classificar_saude(tem_dados, entradas_mes, despesas_mes, reserva_meses, taxa_poupanca_pct, criterios):
    if not tem_dados:
        return "neutro"
    # Gastando mais do que ganha, ou reserva abaixo do mínimo -> vermelho.
    if entradas_mes > 0 and despesas_mes > entradas_mes:
        return "vermelho"
    rm = reserva_meses if reserva_meses is not None else 0
    poup = taxa_poupanca_pct if taxa_poupanca_pct is not None else 0
    if rm < criterios.reserva_min_meses:
        return "vermelho"
    if poup >= criterios.azul_poupanca_pct and rm >= criterios.azul_reserva_meses:
        return "azul"  # excelente / rumo à independência
    if poup >= criterios.verde_poupanca_pct and rm >= criterios.verde_reserva_meses:
        return "verde"  # saudável
    return "amarelo"  # regular / dá pra melhorar


def _criterios_do_profissional(profissional) -> CriteriosSaude:
    """Limiares configurados pelo planejador (ou os defaults do banco)."""
    return CriteriosSaude(
        reserva_min_meses=float(profissional.saude_reserva_min_meses),
        verde_reserva_meses=float(profissional.saude_verde_reserva_meses),
        verde_poupanca_pct=float(profissional.saude_verde_poupanca_pct),
        azul_reserva_meses=float(profissional.saude_azul_reserva_meses),
        azul_poupanca_pct=float(profissional.saude_azul_poupanca_pct),
    )


def _computar_saude(db: Session, cliente_id: uuid.UUID, contexto: str | None = None) -> dict:
    """Núcleo do diagnóstico de saúde (organização financeira do mês). Devolve
    um dict com score/mensagens/indicadores -- usado tanto pela rota
    /saude-financeira quanto pelo /indice-saude (dimensão Organização)."""
    hoje = date.today()
    inicio_mes = hoje.replace(day=1)
    # Respeita a visão Pessoal/Empresa: só soma os lançamentos do contexto pedido.
    cond_ctx = [Transacao.contexto == contexto] if contexto in ("PF", "PJ") else []

    entradas_mes = float(
        db.scalar(
            select(func.coalesce(func.sum(Transacao.valor), 0)).where(
                Transacao.cliente_id == cliente_id, Transacao.tipo == "entrada",
                Transacao.data >= inicio_mes, *cond_ctx, *_condicoes_fluxo_real()
            )
        )
        or 0
    )
    despesas_mes = float(
        abs(
            db.scalar(
                select(func.coalesce(func.sum(Transacao.valor), 0)).where(
                    Transacao.cliente_id == cliente_id, Transacao.tipo == "saida",
                    Transacao.data >= inicio_mes, *cond_ctx, *_condicoes_fluxo_real()
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

    # Reserva de emergência = saldo de caixa disponível (todas as entradas -
    # saídas reais, sem previstos/neutras). Quantos meses de gasto ela cobre.
    saldo_caixa = float(
        db.scalar(
            select(
                func.coalesce(
                    func.sum(
                        case(
                            (Transacao.tipo == "entrada", func.abs(Transacao.valor)),
                            else_=-func.abs(Transacao.valor),
                        )
                    ),
                    0,
                )
            ).where(Transacao.cliente_id == cliente_id, *cond_ctx, *_condicoes_fluxo_real())
        )
        or 0
    )
    reserva_meses = round(max(0.0, saldo_caixa) / despesas_mes, 1) if despesas_mes > 0 else None
    taxa_poupanca_pct = (
        round((entradas_mes - despesas_mes) / entradas_mes * 100, 1) if entradas_mes > 0 else None
    )

    cliente = db.get(Cliente, cliente_id)
    profissional = db.get(Profissional, cliente.profissional_id) if cliente else None
    criterios = _criterios_do_profissional(profissional) if profissional else CriteriosSaude(
        reserva_min_meses=3, verde_reserva_meses=6, verde_poupanca_pct=15,
        azul_reserva_meses=12, azul_poupanca_pct=30,
    )
    classificacao = _classificar_saude(
        tem_dados, entradas_mes, despesas_mes, reserva_meses, taxa_poupanca_pct, criterios
    )

    return {
        "classificacao": classificacao,
        "reserva_meses": reserva_meses,
        "taxa_poupanca_pct": taxa_poupanca_pct,
        "criterios": criterios,
        "tem_dados": tem_dados,
        "score": score,
        "receitas_mes": entradas_mes,
        "despesas_mes": despesas_mes,
        "gasto_acima_renda_pct": gasto_acima_renda_pct,
        "comprometimento_dividas_pct": comprometimento_dividas_pct,
        "mensagens": mensagens,
        "planejador_whatsapp": profissional.whatsapp if profissional else None,
    }


@router.get("/saude-financeira", response_model=SaudeFinanceiraResposta)
def obter_saude_financeira(
    contexto: str | None = None,  # 'PF' | 'PJ' -- separa pessoal do controle da empresa
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    """Diagnóstico rápido do mês corrente pro cliente ver logo de cara: quanto
    ganhou x gastou, e quanto das despesas está comprometido com dívidas."""
    return SaudeFinanceiraResposta(**_computar_saude(db, cliente_id, contexto))


def _zona_do_score(s: int | None) -> str:
    if s is None:
        return "Sem dados"
    if s < 20:
        return "Na contramão"
    if s < 50:
        return "Desvio de rota"
    if s < 75:
        return "Zona de atenção"
    return "A todo vapor"


def _msg(tipo: str, texto: str) -> MensagemSaudeFinanceira:
    return MensagemSaudeFinanceira(tipo=tipo, texto=texto)


def _indice_saude(db: Session, cliente_id: uuid.UUID, contexto: str | None = None) -> IndiceSaudeResposta:
    """Compõe o índice geral a partir de 4 dimensões, reaproveitando os cálculos
    que já existem (saúde do mês, patrimônio, simulação, alocação de metas). Não
    recalcula nada do zero -- é uma camada de leitura/resumo."""
    dims: list[DimensaoIndice] = []

    # 1) Organização financeira -- reusa o diagnóstico de saúde do mês.
    saude = _computar_saude(db, cliente_id, contexto)
    org_score = saude["score"] if saude["tem_dados"] else None
    dims.append(
        DimensaoIndice(
            chave="organizacao",
            nome="Organização financeira",
            score=org_score,
            zona=_zona_do_score(org_score),
            tem_dados=saude["tem_dados"],
            mensagens=saude["mensagens"],
        )
    )

    # 2) Meu patrimônio -- endividamento x % de ativos gerando renda.
    patr = _calcular_patrimonio(db, cliente_id)
    ativos = max(0.0, patr["saldo_contas"]) + patr["total_investido"] + patr["total_bens"]
    tem_patr = ativos > 0 or patr["total_dividas"] > 0
    if tem_patr:
        endivid_pct = min(100.0, patr["total_dividas"] / ativos * 100) if ativos > 0 else 100.0
        pct_gerador = (patr["total_investido"] / ativos * 100) if ativos > 0 else 0.0
        patr_score = round(max(0.0, min(100.0, 0.5 * (100 - endivid_pct) + 0.5 * pct_gerador)))
        msgs_patr = []
        if patr["total_dividas"] <= 0:
            msgs_patr.append(_msg("positivo", "Sensacional! Você não possui nenhum tipo de dívida no seu patrimônio atual."))
        else:
            msgs_patr.append(_msg("alerta", f"Suas dívidas representam {round(endivid_pct, 1)}% dos seus ativos. Reduzi-las acelera seu patrimônio líquido."))
        if pct_gerador >= 60:
            msgs_patr.append(_msg("positivo", f"Você possui {round(pct_gerador, 1)}% dos ativos gerando renda. Continue acelerando rumo à independência!"))
        else:
            msgs_patr.append(_msg("neutro", f"Apenas {round(pct_gerador, 1)}% dos seus ativos geram renda. Investir mais aumenta esse número."))
    else:
        patr_score = None
        msgs_patr = [_msg("neutro", "Cadastre seus investimentos, bens e dívidas em Patrimônio pra ver esta dimensão.")]
    dims.append(
        DimensaoIndice(
            chave="patrimonio", nome="Meu patrimônio", score=patr_score,
            zona=_zona_do_score(patr_score), tem_dados=tem_patr, mensagens=msgs_patr,
        )
    )

    # 3) Liberdade financeira -- cobertura da independência na simulação mais recente.
    sim = db.scalars(
        select(Simulacao).where(Simulacao.cliente_id == cliente_id).order_by(Simulacao.criado_em.desc())
    ).first()
    if sim and sim.patrimonio_necessario and float(sim.patrimonio_necessario) > 0 and sim.valor_final_projetado is not None:
        cobertura = float(sim.valor_final_projetado) / float(sim.patrimonio_necessario) * 100
        lib_score = round(max(0.0, min(100.0, cobertura)))
        if cobertura >= 100:
            msgs_lib = [_msg("positivo", f"Seu patrimônio projetado já cobre {round(cobertura, 1)}% da sua independência financeira. A todo vapor!")]
        else:
            msgs_lib = [_msg("alerta", f"Seu patrimônio projetado representa {round(cobertura, 2)}% do necessário pra sua independência financeira. Continue acelerando!")]
        tem_lib = True
    else:
        lib_score = None
        tem_lib = False
        msgs_lib = [_msg("neutro", "Faça uma simulação em Meu Futuro (com renda desejada e idade) pra calcular sua liberdade financeira.")]
    dims.append(
        DimensaoIndice(
            chave="liberdade", nome="Liberdade financeira", score=lib_score,
            zona=_zona_do_score(lib_score), tem_dados=tem_lib, mensagens=msgs_lib,
        )
    )

    # 4) Gestão de ativos -- quanto das metas de reserva e de projetos já está alocado.
    metas = db.scalars(
        select(Meta).where(Meta.cliente_id == cliente_id, Meta.status != "concluida")
    ).all()
    meta_ids = [m.id for m in metas]
    alocado_por_meta: dict = {}
    if meta_ids:
        linhas = db.execute(
            select(InvestimentoAlocacao.meta_id, func.coalesce(func.sum(InvestimentoAlocacao.valor_alocado), 0))
            .where(InvestimentoAlocacao.meta_id.in_(meta_ids))
            .group_by(InvestimentoAlocacao.meta_id)
        ).all()
        alocado_por_meta = {mid: float(tot) for mid, tot in linhas}

    def _progresso(grupo):
        alvo = sum(float(m.valor_alvo) for m in grupo if m.valor_alvo)
        aloc = sum(alocado_por_meta.get(m.id, 0.0) for m in grupo if m.valor_alvo)
        return (min(100.0, aloc / alvo * 100) if alvo > 0 else None)

    reserva_metas = [m for m in metas if m.tipo == "reserva_emergencia"]
    projeto_metas = [m for m in metas if m.tipo != "reserva_emergencia"]
    reserva_pct = _progresso(reserva_metas)
    projetos_pct = _progresso(projeto_metas)
    disponiveis = [x for x in (reserva_pct, projetos_pct) if x is not None]
    if disponiveis:
        gestao_score = round(sum(disponiveis) / len(disponiveis))
        msgs_gestao = []
        if reserva_pct is not None:
            if reserva_pct >= 100:
                msgs_gestao.append(_msg("positivo", "Sua meta de reserva de emergência está 100% alocada. Mandou bem!"))
            else:
                msgs_gestao.append(_msg("alerta", f"Você possui apenas {round(reserva_pct, 2)}% da sua meta de reserva de emergência alocada. Mantenha uma reserva adequada!"))
        if projetos_pct is not None:
            if projetos_pct >= 100:
                msgs_gestao.append(_msg("positivo", "Seus projetos estão 100% financiados pelos investimentos alocados."))
            else:
                msgs_gestao.append(_msg("alerta", f"Você possui apenas {round(projetos_pct, 2)}% alocado para realizar os seus projetos. Revise a alocação ou peça auxílio ao planejador!"))
        tem_gestao = True
    else:
        gestao_score = None
        tem_gestao = False
        msgs_gestao = [_msg("neutro", "Cadastre projetos com valor-alvo (aba Projetos) e aloque seus investimentos pra acompanhar esta dimensão.")]
    dims.append(
        DimensaoIndice(
            chave="gestao_ativos", nome="Gestão de ativos", score=gestao_score,
            zona=_zona_do_score(gestao_score), tem_dados=tem_gestao, mensagens=msgs_gestao,
        )
    )

    scores = [d.score for d in dims if d.score is not None]
    indice = round(sum(scores) / len(scores)) if scores else 0
    return IndiceSaudeResposta(
        indice_geral=indice,
        zona=_zona_do_score(indice) if scores else "Sem dados",
        dimensoes=dims,
        planejador_whatsapp=saude["planejador_whatsapp"],
    )


@router.get("/indice-saude", response_model=IndiceSaudeResposta)
def obter_indice_saude(
    contexto: str | None = None,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    """Raio-X consolidado (índice geral + 4 dimensões) -- porta de entrada que
    resume a saúde financeira e leva pra aba de detalhe de cada dimensão."""
    return _indice_saude(db, cliente_id, contexto)


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
        subtipo=dados.subtipo if dados.tipo == "imovel" else None,
        nome=dados.nome,
        valor=dados.valor,
        proprietario=dados.proprietario if dados.proprietario in ("titular", "conjuge", "ambos") else "titular",
        saldo_devedor=dados.saldo_devedor or 0,
        valor_prestacao=dados.valor_prestacao or 0,
    )
    db.add(bem)
    db.flush()
    db.refresh(bem)
    return bem


@router.patch("/bens/{bem_id}", response_model=BemResposta)
def atualizar_bem(
    bem_id: uuid.UUID,
    dados: BemAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    bem = db.get(BemPatrimonial, bem_id)
    if bem is None or bem.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bem não encontrado")
    if dados.tipo is not None and dados.tipo not in TIPOS_BEM:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(bem, campo, valor)
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
# Milhas aéreas (parte do Patrimônio)
# ============================================================================
@router.get("/milhas", response_model=list[MilhaResposta])
def listar_milhas(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    return db.scalars(
        select(Milha).where(Milha.cliente_id == cliente_id).order_by(Milha.criado_em.desc())
    ).all()


@router.post("/milhas", response_model=MilhaResposta, status_code=status.HTTP_201_CREATED)
def criar_milha(
    dados: MilhaCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    milha = Milha(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        categoria=dados.categoria,
        programa=dados.programa,
        quantidade=dados.quantidade or 0,
        proprietario=dados.proprietario if dados.proprietario in ("titular", "conjuge") else "titular",
        vencimento=dados.vencimento,
    )
    db.add(milha)
    db.flush()
    db.refresh(milha)
    return milha


@router.patch("/milhas/{milha_id}", response_model=MilhaResposta)
def atualizar_milha(
    milha_id: uuid.UUID,
    dados: MilhaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    milha = db.get(Milha, milha_id)
    if milha is None or milha.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milha não encontrada")
    for campo in ("categoria", "programa", "quantidade", "proprietario", "vencimento"):
        valor = getattr(dados, campo)
        if valor is not None:
            setattr(milha, campo, valor)
    db.flush()
    db.refresh(milha)
    return milha


@router.delete("/milhas/{milha_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_milha(
    milha_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    milha = db.get(Milha, milha_id)
    if milha is None or milha.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milha não encontrada")
    db.delete(milha)


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


# Metas são RECORRENTES: guardadas com ano=0 (sentinela "todo mês"; o mês fica
# num valor válido só pra respeitar o CHECK, mas é ignorado). O valor realizado
# é sempre calculado pro mês que está sendo visto (ano_ref/mes_ref).
def _orcamento_resposta(
    db: Session,
    orc: OrcamentoCategoria,
    categoria_nome: str | None,
    subcategoria_nome: str | None,
    ano_ref: int,
    mes_ref: int,
) -> OrcamentoResposta:
    return OrcamentoResposta(
        id=orc.id,
        categoria_id=orc.categoria_id,
        categoria_nome=categoria_nome,
        subcategoria_id=orc.subcategoria_id,
        subcategoria_nome=subcategoria_nome,
        ano=ano_ref,
        mes=mes_ref,
        valor_orcado=orc.valor_orcado,
        valor_realizado=_calcular_realizado(db, orc.cliente_id, orc.categoria_id, ano_ref, mes_ref, orc.subcategoria_id),
    )


@router.get("/orcamentos", response_model=list[OrcamentoResposta])
def listar_orcamentos(
    ano: int,
    mes: int,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    # Metas recorrentes (ano=0) valem pra todo mês; o realizado é do mês pedido.
    linhas = db.execute(
        select(OrcamentoCategoria, Categoria.nome, Subcategoria.nome)
        .join(Categoria, Categoria.id == OrcamentoCategoria.categoria_id)
        .outerjoin(Subcategoria, Subcategoria.id == OrcamentoCategoria.subcategoria_id)
        .where(OrcamentoCategoria.cliente_id == cliente_id, OrcamentoCategoria.ano == 0)
    ).all()
    return [_orcamento_resposta(db, orc, cat_nome, sub_nome, ano, mes) for orc, cat_nome, sub_nome in linhas]


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

    # Meta recorrente: uma por (categoria, subcategoria), vale pra todo mês.
    existente = db.scalar(
        select(OrcamentoCategoria).where(
            OrcamentoCategoria.cliente_id == cliente_id,
            OrcamentoCategoria.categoria_id == dados.categoria_id,
            OrcamentoCategoria.subcategoria_id == dados.subcategoria_id,
            OrcamentoCategoria.ano == 0,
        )
    )
    if existente:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma meta pra essa categoria/subcategoria.")

    orcamento = OrcamentoCategoria(
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        categoria_id=dados.categoria_id,
        subcategoria_id=dados.subcategoria_id,
        ano=0,       # recorrente
        mes=1,       # valor válido só pro CHECK; ignorado (filtramos por ano=0)
        valor_orcado=dados.valor_orcado,
    )
    db.add(orcamento)
    db.flush()
    db.refresh(orcamento)
    # Realizado exibido = do mês que o cliente está vendo (dados.ano/mes).
    return _orcamento_resposta(db, orcamento, categoria.nome, subcategoria.nome if subcategoria else None, dados.ano, dados.mes)


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
    hoje = date.today()
    return _orcamento_resposta(
        db, orcamento, categoria.nome if categoria else None,
        subcategoria.nome if subcategoria else None, hoje.year, hoje.month,
    )


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


# Nomes das categorias-grupo usadas na calculadora de seguro (padrão de vida).
_GRUPOS_PROTECAO = {
    "obrigatorias": "Despesas obrigatórias",
    "empresa": "Empresa e autônomo",
    "nao_obrigatorias": "Despesas não obrigatórias",
    "projetos": "Projetos",
}
_MESES_MEDIA_PROTECAO = 6


@router.get("/protecao/medias", response_model=ProtecaoMediasResposta)
def protecao_medias(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    """Média mensal de renda e de gasto por grupo de categoria (últimos ~6 meses)
    -- usado pelo botão 'Preencher automaticamente' da aba Proteção."""
    hoje = date.today()
    # início ~6 meses atrás (1º dia)
    y, m = hoje.year, hoje.month - _MESES_MEDIA_PROTECAO + 1
    while m <= 0:
        m += 12
        y -= 1
    inicio = date(y, m, 1)

    def _media(*conds):
        total = float(
            db.scalar(
                select(func.coalesce(func.sum(func.abs(Transacao.valor)), 0)).where(
                    Transacao.cliente_id == cliente_id, Transacao.data >= inicio, *conds, *_condicoes_fluxo_real()
                )
            )
            or 0
        )
        return round(total / _MESES_MEDIA_PROTECAO, 2)

    renda = _media(Transacao.tipo == "entrada")
    por_grupo = {}
    for chave, nome_cat in _GRUPOS_PROTECAO.items():
        cat_ids = [
            c for c in db.scalars(
                select(Categoria.id).where(Categoria.nome == nome_cat, Categoria.cliente_id.is_(None))
            ).all()
        ]
        por_grupo[chave] = _media(Transacao.tipo == "saida", Transacao.categoria_id.in_(cat_ids)) if cat_ids else 0.0

    patr = _calcular_patrimonio(db, cliente_id)
    return ProtecaoMediasResposta(
        renda_mensal=renda,
        obrigatorias=por_grupo["obrigatorias"],
        empresa=por_grupo["empresa"],
        nao_obrigatorias=por_grupo["nao_obrigatorias"],
        projetos=por_grupo["projetos"],
        patrimonio_liquido=float(patr["patrimonio_liquido"]),
        meses_considerados=_MESES_MEDIA_PROTECAO,
    )


@router.get("/protecao/config", response_model=ProtecaoConfigResposta)
def obter_protecao_config(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    pc = db.get(ProtecaoConfig, cliente_id)
    return ProtecaoConfigResposta(config=pc.config if pc else {})


@router.put("/protecao/config", response_model=ProtecaoConfigResposta)
def salvar_protecao_config(
    dados: ProtecaoConfigAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    pc = db.get(ProtecaoConfig, cliente_id)
    if pc is None:
        pc = ProtecaoConfig(cliente_id=cliente_id, profissional_id=cliente.profissional_id, config=dados.config)
        db.add(pc)
    else:
        pc.config = dados.config
    db.flush()
    db.refresh(pc)
    return ProtecaoConfigResposta(config=pc.config)


@router.get("/plano-investimento/config", response_model=PlanoInvestimentoResposta)
def obter_plano_investimento(cliente_id: uuid.UUID = Depends(get_cliente_id_atual), db: Session = Depends(get_db_admin)):
    pc = db.get(PlanoInvestimentoConfig, cliente_id)
    return PlanoInvestimentoResposta(config=pc.config if pc else {})


@router.put("/plano-investimento/config", response_model=PlanoInvestimentoResposta)
def salvar_plano_investimento(
    dados: PlanoInvestimentoAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente(db, cliente_id)
    pc = db.get(PlanoInvestimentoConfig, cliente_id)
    if pc is None:
        pc = PlanoInvestimentoConfig(cliente_id=cliente_id, profissional_id=cliente.profissional_id, config=dados.config)
        db.add(pc)
    else:
        pc.config = dados.config
    db.flush()
    db.refresh(pc)
    return PlanoInvestimentoResposta(config=pc.config)


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
    # Cobertura recomendada: se o cliente configurou a calculadora (educação +
    # padrão de vida + sucessão), usa a soma dessas necessidades. Senão, cai no
    # atalho renda × múltiplo.
    pc = db.get(ProtecaoConfig, cliente_id)
    ideal = _cobertura_ideal(pc.config, _calcular_patrimonio(db, cliente_id)) if pc and pc.config else 0.0
    cobertura_recomendada = ideal if ideal > 0 else renda_mensal * MULTIPLICADOR_COBERTURA_RECOMENDADA

    return MinhaProtecaoResposta(
        cobertura_atual=cobertura_atual,
        cobertura_recomendada=cobertura_recomendada,
        apolices=apolices,
    )


def _cobertura_ideal(config: dict, patr: dict) -> float:
    """Soma das 3 necessidades de seguro de vida (mesma fórmula do frontend):
    educação/dependentes + padrão de vida + sucessão patrimonial."""
    def n(v):
        try:
            return float(v or 0)
        except (TypeError, ValueError):
            return 0.0

    total = 0.0
    # Educação/dependentes: anos × 12 × auxílio mensal (só os ativos).
    for dep in (config.get("dependentes") or []):
        if dep.get("ativo", True):
            total += n(dep.get("anos")) * 12 * n(dep.get("auxilio_mensal"))
    # Padrão de vida: soma das categorias ativas × 12 × período (anos).
    pv = config.get("padrao_vida") or {}
    cats = pv.get("categorias") or {}
    mensal = sum(n(c.get("valor")) for c in cats.values() if c.get("ativo"))
    total += mensal * 12 * n(pv.get("periodo_anos"))
    # Sucessão: despesas específicas + (honorários% + ITCMD%) × patrimônio líquido.
    suc = config.get("sucessao") or {}
    pl = n(patr.get("patrimonio_liquido"))
    total += n(suc.get("despesas_especificas")) + (n(suc.get("honorarios_pct")) + n(suc.get("itcmd_pct"))) / 100 * pl
    return round(total, 2)


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
        titular=dados.titular,
        tipo=dados.tipo,
        seguradora=dados.seguradora,
        valor_cobertura=dados.valor_cobertura,
        premio_mensal=dados.premio_mensal,
        vigencia_inicio=dados.vigencia_inicio,
        vencimento=dados.vencimento,
    )
    db.add(apolice)
    db.flush()
    db.refresh(apolice)
    return apolice


@router.patch("/apolices/{apolice_id}", response_model=ApoliceResposta)
def atualizar_apolice(
    apolice_id: uuid.UUID,
    dados: ApoliceAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    apolice = db.get(ApoliceSeguro, apolice_id)
    if apolice is None or apolice.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Apólice não encontrada")
    if dados.tipo is not None and dados.tipo not in TIPOS_APOLICE:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(apolice, campo, valor)
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
