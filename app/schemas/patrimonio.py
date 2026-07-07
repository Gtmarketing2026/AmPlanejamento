import uuid
from datetime import date, datetime

from pydantic import BaseModel

TIPOS_META = {
    "aposentadoria",
    "viagem",
    "imovel",
    "quitar_divida",
    "reserva_emergencia",
    "educacao",
    "outro",
}
STATUS_META = {"em_andamento", "concluida", "pausada"}
# essencial = curto prazo · desejo = médio prazo · sonho = longo prazo
PRIORIDADES_META = {"essencial", "desejo", "sonho"}

TIPOS_DIVIDA = {
    "emprestimo_pessoal",
    "financiamento_imobiliario",
    "financiamento_veiculo",
    "cartao_parcelado",
    "cheque_especial",
    "outro",
}
STATUS_DIVIDA = {"ativa", "quitada", "atrasada"}

TIPOS_INVESTIMENTO = {
    "acao",
    "fundo",
    "fii",
    "renda_fixa",
    "tesouro_direto",
    "previdencia",
    "cripto",
    "outro",
}


# ---------- Metas ----------
class MetaCriar(BaseModel):
    titulo: str
    tipo: str = "outro"
    prioridade: str = "desejo"
    valor_alvo: float | None = None
    prazo: date | None = None


class MetaAtualizar(BaseModel):
    titulo: str | None = None
    tipo: str | None = None
    prioridade: str | None = None
    valor_alvo: float | None = None
    prazo: date | None = None
    status: str | None = None


class MetaResposta(BaseModel):
    id: uuid.UUID
    titulo: str
    tipo: str
    prioridade: str
    valor_alvo: float | None
    valor_atual: float
    progresso_pct: float | None
    prazo: date | None
    status: str
    criado_em: datetime

    model_config = {"from_attributes": True}


class MetaAporteCriar(BaseModel):
    valor: float
    data: date | None = None


class MetaAporteResposta(BaseModel):
    id: uuid.UUID
    meta_id: uuid.UUID
    valor: float
    data: date
    origem: str
    criado_em: datetime

    model_config = {"from_attributes": True}


# ---------- Dívidas ----------
class DividaCriar(BaseModel):
    tipo: str
    credor: str
    valor_total: float
    valor_pago: float = 0
    taxa_juros_mensal_pct: float | None = None
    parcelas_totais: int | None = None
    parcelas_pagas: int = 0
    data_inicio: date | None = None
    data_prevista_quitacao: date | None = None


class DividaAtualizar(BaseModel):
    credor: str | None = None
    valor_pago: float | None = None
    parcelas_pagas: int | None = None
    data_prevista_quitacao: date | None = None
    status: str | None = None


class DividaResposta(BaseModel):
    id: uuid.UUID
    tipo: str
    credor: str
    valor_total: float
    valor_pago: float
    valor_restante: float
    taxa_juros_mensal_pct: float | None
    parcelas_totais: int | None
    parcelas_pagas: int
    data_inicio: date | None
    data_prevista_quitacao: date | None
    status: str
    criado_em: datetime

    model_config = {"from_attributes": True}


# ---------- Investimentos ----------
class InvestimentoCriar(BaseModel):
    tipo: str
    nome_ativo: str
    quantidade: float | None = None
    valor_aplicado: float | None = None
    valor_atual: float | None = None
    data_referencia: date | None = None


class InvestimentoAtualizar(BaseModel):
    nome_ativo: str | None = None
    quantidade: float | None = None
    valor_aplicado: float | None = None
    valor_atual: float | None = None


class InvestimentoResposta(BaseModel):
    id: uuid.UUID
    tipo: str
    nome_ativo: str
    quantidade: float | None
    valor_aplicado: float | None
    valor_atual: float | None
    data_referencia: date
    criado_em: datetime

    model_config = {"from_attributes": True}


# ---------- Bens patrimoniais (móveis/imóveis) ----------
TIPOS_BEM = {"movel", "imovel"}


class BemCriar(BaseModel):
    tipo: str
    nome: str
    valor: float


class BemResposta(BaseModel):
    id: uuid.UUID
    tipo: str
    nome: str
    valor: float
    criado_em: datetime

    model_config = {"from_attributes": True}


# ---------- Orçamento por categoria ----------
class OrcamentoCriar(BaseModel):
    categoria_id: uuid.UUID
    ano: int
    mes: int
    valor_orcado: float


class OrcamentoAtualizar(BaseModel):
    valor_orcado: float


class OrcamentoResposta(BaseModel):
    id: uuid.UUID
    categoria_id: uuid.UUID
    categoria_nome: str | None = None
    ano: int
    mes: int
    valor_orcado: float
    valor_realizado: float = 0

    model_config = {"from_attributes": True}


# ---------- Patrimônio (agregado) ----------
class PatrimonioResposta(BaseModel):
    saldo_contas: float
    total_investido: float
    total_bens: float
    total_dividas: float
    patrimonio_liquido: float


# ---------- Saúde financeira (termômetro + alertas do mês) ----------
class MensagemSaudeFinanceira(BaseModel):
    tipo: str  # alerta | positivo | neutro
    texto: str


class SaudeFinanceiraResposta(BaseModel):
    tem_dados: bool
    score: int  # 0-100, usado pra posicionar o ponteiro do termômetro
    receitas_mes: float
    despesas_mes: float
    gasto_acima_renda_pct: float | None  # None se não está gastando mais do que ganha
    comprometimento_dividas_pct: float | None  # % das despesas do mês tomado por parcelas de dívida
    mensagens: list[MensagemSaudeFinanceira]
    planejador_whatsapp: str | None = None


# ---------- Simulação (Meu Futuro / independência financeira) ----------
# Taxas reais (já descontada a inflação) -- padrão conservador, editável.
TAXA_ACUMULACAO_PADRAO_PCT = 4.0
TAXA_POS_APOSENTADORIA_PADRAO_PCT = 3.5


class SimulacaoCriar(BaseModel):
    nome_cenario: str = "Cenário base"
    patrimonio_inicial: float
    aporte_mensal: float
    taxa_retorno_anual_pct: float = TAXA_ACUMULACAO_PADRAO_PCT
    prazo_anos: int
    idade_atual: int | None = None
    idade_aposentadoria: int | None = None
    renda_desejada_mensal: float | None = None
    outras_rendas_mensal: float = 0
    taxa_pos_aposentadoria_pct: float = TAXA_POS_APOSENTADORIA_PADRAO_PCT


class SimulacaoResposta(BaseModel):
    id: uuid.UUID
    nome_cenario: str
    patrimonio_inicial: float
    aporte_mensal: float
    taxa_retorno_anual_pct: float
    prazo_anos: int
    valor_final_projetado: float | None
    idade_atual: int | None
    idade_aposentadoria: int | None
    renda_desejada_mensal: float | None
    outras_rendas_mensal: float | None
    taxa_pos_aposentadoria_pct: float | None
    aporte_necessario: float | None
    patrimonio_necessario: float | None
    criado_em: datetime

    model_config = {"from_attributes": True}
