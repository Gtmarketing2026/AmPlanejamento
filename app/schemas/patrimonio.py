import uuid
from datetime import date, datetime

from pydantic import BaseModel

# Tipos "conhecidos" (com ícone no frontend). O cliente também pode criar um
# tipo PERSONALIZADO -- por isso a rota NÃO restringe o tipo a este conjunto,
# só usa como referência. Ver MetasTab.jsx (TIPOS).
TIPOS_META = {
    "viagem",
    "veiculo",
    "casa",
    "familia",
    "eletronico",
    "educacao",
    "hobby",
    "profissional",
    "saude",
    "aposentadoria",
    "imovel",
    "reserva_emergencia",
    "quitar_divida",
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
    data_inicial: date | None = None
    prazo: date | None = None
    aporte_mensal_meta: float | None = None


class MetaAtualizar(BaseModel):
    titulo: str | None = None
    tipo: str | None = None
    prioridade: str | None = None
    valor_alvo: float | None = None
    data_inicial: date | None = None
    prazo: date | None = None
    status: str | None = None
    aporte_mensal_meta: float | None = None


class MetaResposta(BaseModel):
    id: uuid.UUID
    titulo: str
    tipo: str
    prioridade: str
    valor_alvo: float | None
    valor_atual: float
    progresso_pct: float | None
    data_inicial: date | None = None
    prazo: date | None
    status: str
    aporte_mensal_meta: float | None = None
    # Soma do que já está alocado a esta meta via investimentos (calculado
    # na rota, não é coluna -- ver investimento_alocacoes).
    valor_investido_alocado: float = 0

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
    responsavel: str = "titular"  # titular | conjuge | ambos
    valor_total: float
    valor_pago: float = 0
    taxa_juros_mensal_pct: float | None = None
    parcelas_totais: int | None = None
    parcelas_pagas: int = 0
    data_inicio: date | None = None
    data_prevista_quitacao: date | None = None


class DividaAtualizar(BaseModel):
    tipo: str | None = None
    credor: str | None = None
    responsavel: str | None = None
    valor_total: float | None = None
    valor_pago: float | None = None
    taxa_juros_mensal_pct: float | None = None
    parcelas_totais: int | None = None
    parcelas_pagas: int | None = None
    data_inicio: date | None = None
    data_prevista_quitacao: date | None = None
    status: str | None = None


class DividaResposta(BaseModel):
    id: uuid.UUID
    tipo: str
    credor: str
    responsavel: str = "titular"
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
class AlocacaoCriar(BaseModel):
    meta_id: uuid.UUID
    valor_alocado: float


class AlocacaoResposta(BaseModel):
    id: uuid.UUID
    meta_id: uuid.UUID
    meta_titulo: str | None = None
    valor_alocado: float

    model_config = {"from_attributes": True}


class InvestimentoCriar(BaseModel):
    tipo: str
    classe_ativo: str | None = None
    nome_ativo: str
    quantidade: float | None = None
    valor_aplicado: float | None = None
    valor_atual: float | None = None
    data_referencia: date | None = None
    instituicao_nome: str | None = None
    liquidez: str | None = None
    data_vencimento: date | None = None
    # Se informado, substitui a divisão do valor entre objetivos de uma vez
    # (não precisa de tela separada -- o cliente já aloca ao criar/editar).
    alocacoes: list[AlocacaoCriar] | None = None


class InvestimentoAtualizar(BaseModel):
    nome_ativo: str | None = None
    classe_ativo: str | None = None
    quantidade: float | None = None
    valor_aplicado: float | None = None
    valor_atual: float | None = None
    instituicao_nome: str | None = None
    liquidez: str | None = None
    data_vencimento: date | None = None
    alocacoes: list[AlocacaoCriar] | None = None


class InvestimentoResposta(BaseModel):
    id: uuid.UUID
    tipo: str
    classe_ativo: str | None = None
    nome_ativo: str
    quantidade: float | None
    valor_aplicado: float | None
    valor_atual: float | None
    data_referencia: date
    instituicao_nome: str | None = None
    liquidez: str | None = None
    data_vencimento: date | None = None
    criado_em: datetime
    alocacoes: list[AlocacaoResposta] = []

    model_config = {"from_attributes": True}


# ---------- Milhas aéreas ----------
class MilhaCriar(BaseModel):
    categoria: str | None = None
    programa: str
    quantidade: int = 0
    proprietario: str = "titular"  # titular | conjuge
    vencimento: date | None = None


class MilhaAtualizar(BaseModel):
    categoria: str | None = None
    programa: str | None = None
    quantidade: int | None = None
    proprietario: str | None = None
    vencimento: date | None = None


class MilhaResposta(BaseModel):
    id: uuid.UUID
    categoria: str | None
    programa: str
    quantidade: int
    proprietario: str
    vencimento: date | None
    criado_em: datetime

    model_config = {"from_attributes": True}


# ---------- Bens patrimoniais (móveis/imóveis) ----------
TIPOS_BEM = {"movel", "imovel"}


class BemCriar(BaseModel):
    tipo: str
    subtipo: str | None = None  # imóvel: Residencial/Veraneio/Comercial/Investimento/Participação empresa
    nome: str
    valor: float
    proprietario: str = "titular"  # titular | conjuge | ambos
    saldo_devedor: float = 0
    valor_prestacao: float = 0


class BemAtualizar(BaseModel):
    tipo: str | None = None
    subtipo: str | None = None
    nome: str | None = None
    valor: float | None = None
    proprietario: str | None = None
    saldo_devedor: float | None = None
    valor_prestacao: float | None = None


class BemResposta(BaseModel):
    id: uuid.UUID
    tipo: str
    subtipo: str | None = None
    nome: str
    valor: float
    proprietario: str = "titular"
    saldo_devedor: float = 0
    valor_prestacao: float = 0
    criado_em: datetime

    model_config = {"from_attributes": True}


# ---------- Orçamento por categoria ----------
class OrcamentoCriar(BaseModel):
    categoria_id: uuid.UUID
    subcategoria_id: uuid.UUID | None = None  # opcional: meta mais específica
    ano: int
    mes: int
    valor_orcado: float


class OrcamentoAtualizar(BaseModel):
    valor_orcado: float


class OrcamentoResposta(BaseModel):
    id: uuid.UUID
    categoria_id: uuid.UUID
    categoria_nome: str | None = None
    subcategoria_id: uuid.UUID | None = None
    subcategoria_nome: str | None = None
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


class ResumoPatrimonialResposta(BaseModel):
    """Visão em fatias do Patrimônio -- pros donuts de Ativos/Passivos."""

    ativos_liquidez: float  # saldo em conta
    ativos_investimentos: float
    ativos_bens: float
    passivos_dividas: float
    patrimonio_liquido: float
    pct_ativo_gerador_renda: float  # % dos ativos que são investimentos (rendem)


# ---------- Apólices de seguro (Minha Proteção) ----------
TIPOS_APOLICE = {"vida", "saude", "patrimonial", "outro"}


class ApoliceCriar(BaseModel):
    titular: str | None = None
    tipo: str
    seguradora: str
    valor_cobertura: float
    premio_mensal: float | None = None
    vigencia_inicio: date | None = None
    vencimento: date | None = None  # vigência final


class ApoliceAtualizar(BaseModel):
    titular: str | None = None
    tipo: str | None = None
    seguradora: str | None = None
    valor_cobertura: float | None = None
    premio_mensal: float | None = None
    vigencia_inicio: date | None = None
    vencimento: date | None = None


class ApoliceResposta(BaseModel):
    id: uuid.UUID
    titular: str | None = None
    tipo: str
    seguradora: str
    valor_cobertura: float
    premio_mensal: float | None
    vigencia_inicio: date | None = None
    vencimento: date | None
    criado_em: datetime

    model_config = {"from_attributes": True}


class MinhaProtecaoResposta(BaseModel):
    cobertura_atual: float
    cobertura_recomendada: float
    apolices: list[ApoliceResposta]


# ---------- Calculadora de seguro de vida ideal (config + médias) ----------
class ProtecaoConfigResposta(BaseModel):
    config: dict


class ProtecaoConfigAtualizar(BaseModel):
    config: dict


# ---------- Plano de investimento (distribuição da meta mensal) ----------
class PlanoInvestimentoResposta(BaseModel):
    config: dict


class PlanoInvestimentoAtualizar(BaseModel):
    config: dict


class ProtecaoMediasResposta(BaseModel):
    # Média mensal por grupo de categoria (pra "preencher automaticamente").
    renda_mensal: float
    obrigatorias: float
    empresa: float
    nao_obrigatorias: float
    projetos: float
    patrimonio_liquido: float
    meses_considerados: int


# ---------- Saúde financeira (termômetro + alertas do mês) ----------
class MensagemSaudeFinanceira(BaseModel):
    tipo: str  # alerta | positivo | neutro
    texto: str


class CriteriosSaude(BaseModel):
    """Limiares que classificam a saúde financeira -- editáveis pelo planejador
    na aba Configurações. Devolvidos junto do diagnóstico pra o disclaimer do
    cliente refletir os critérios reais."""

    reserva_min_meses: float
    verde_reserva_meses: float
    verde_poupanca_pct: float
    azul_reserva_meses: float
    azul_poupanca_pct: float


class CriteriosSaudeAtualizar(BaseModel):
    reserva_min_meses: float | None = None
    verde_reserva_meses: float | None = None
    verde_poupanca_pct: float | None = None
    azul_reserva_meses: float | None = None
    azul_poupanca_pct: float | None = None


class DimensaoIndice(BaseModel):
    """Uma das 4 dimensões do índice de saúde financeira."""

    chave: str  # organizacao | patrimonio | liberdade | gestao_ativos
    nome: str
    score: int | None  # 0-100; None quando ainda não há dados pra calcular
    zona: str  # "Na contramão" | "Desvio de rota" | "Zona de atenção" | "A todo vapor" | "Sem dados"
    tem_dados: bool
    mensagens: list["MensagemSaudeFinanceira"] = []


class IndiceSaudeResposta(BaseModel):
    """Raio-X consolidado: índice geral (média das dimensões com dados) + as 4
    dimensões, cada uma linkando pra aba que tem o detalhe/edição."""

    indice_geral: int
    zona: str
    dimensoes: list[DimensaoIndice]
    planejador_whatsapp: str | None = None


class SaudeFinanceiraResposta(BaseModel):
    tem_dados: bool
    score: int  # 0-100, usado pra posicionar o ponteiro do termômetro
    classificacao: str = "neutro"  # vermelho | amarelo | verde | azul | neutro
    reserva_meses: float | None = None  # quantos meses de gasto a reserva de caixa cobre
    taxa_poupanca_pct: float | None = None  # (entradas - despesas) / entradas do mês
    criterios: CriteriosSaude | None = None  # limiares usados (pro disclaimer)
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
