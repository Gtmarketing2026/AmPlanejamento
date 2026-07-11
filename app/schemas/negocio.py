import uuid
from datetime import date, datetime

from pydantic import BaseModel


class MetricasNegocioResposta(BaseModel):
    planejadores_ativos: int
    clientes_ativos_total: int
    media_clientes_por_planejador: float | None
    mrr: float | None
    ticket_medio: float | None
    receita_mes_atual: float
    despesa_mes_atual: float
    # Churn / retenção (novos)
    planejadores_congelados: int = 0
    planejadores_cancelados: int = 0
    clientes_excluidos_total: int = 0
    churn_pct: float | None = None  # % de planejadores cancelados sobre o total já cadastrado
    tempo_medio_assinatura_meses: float | None = None  # vida média (ativos: até hoje; cancelados: até o cancelamento)
    ltv: float | None = None  # ticket médio × tempo médio de assinatura
    receita_acumulada: float = 0  # todas as faturas pagas, desde sempre


class CapacidadeItem(BaseModel):
    """Um limite de serviço externo que pode travar o sistema ao crescer."""

    servico: str
    recurso: str
    uso_atual: float | None  # None quando não é medível automaticamente
    limite: float | None
    unidade: str
    nivel: str  # ok | atencao | critico | info
    observacao: str


class PlanejadorResposta(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    subdominio: str
    status: str
    tipo_plano_atual: str | None
    clientes_ativos: int
    mrr_contribuido: float
    trial_ate: date | None
    em_trial: bool
    vagas_inclusas: int = 4
    valor_vaga_extra: float | None = None
    criado_em: datetime


class VagasAtualizar(BaseModel):
    # Só os campos ENVIADOS são alterados (exclude_unset no backend). Enviar
    # valor_vaga_extra=null zera o custom (volta ao padrão do plano); 0 = grátis.
    vagas_inclusas: int | None = None
    valor_vaga_extra: float | None = None


class ClienteDoPlanejadorResposta(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    documento: str
    nickname: str | None
    status: str
    data_cadastro: date
    valor_honorario_mensal: float | None


class FaturaPlataformaResposta(BaseModel):
    id: uuid.UUID
    profissional_id: uuid.UUID
    planejador_nome: str
    ciclo_referencia: date
    valor_total: float
    status: str


class DespesaResposta(BaseModel):
    id: uuid.UUID
    descricao: str
    categoria: str
    valor: float
    data: date

    model_config = {"from_attributes": True}


class DespesaCriar(BaseModel):
    descricao: str
    categoria: str  # infraestrutura | gateway_pagamento | open_finance | marketing | ferramentas | pessoal | outro
    valor: float
    data: date | None = None


class TransacaoNegocioResposta(BaseModel):
    id: uuid.UUID
    data: date
    descricao: str
    valor: float
    tipo: str
    origem: str
    categoria_id: uuid.UUID | None
    subcategoria_id: uuid.UUID | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Editar senha / login — o admin pode fazer isso pra si mesmo e, via bypass,
# pra qualquer planejador ou cliente final (suporte: usuário esqueceu a
# senha, quer trocar o e-mail/nickname de login etc.)
# ---------------------------------------------------------------------------


class AdminPerfilResposta(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    mfa_ativo: bool = False
    criado_em: datetime

    model_config = {"from_attributes": True}


class AdminLoginRequest(BaseModel):
    email: str
    senha: str
    codigo_totp: str | None = None  # exigido quando o admin tem MFA ativo


class MfaSetupResposta(BaseModel):
    secret: str  # chave base32 pra digitar manualmente no app autenticador
    otpauth_uri: str  # link otpauth:// (pro QR)
    qr_svg_data_uri: str  # QR já pronto como data URI (image/svg+xml)


class MfaCodigo(BaseModel):
    codigo: str


class AdminAtualizar(BaseModel):
    nome: str | None = None
    email: str | None = None
    senha: str | None = None  # só re-hash se enviada


class CredenciaisProfissionalAtualizar(BaseModel):
    email: str | None = None
    senha: str | None = None


class CredenciaisProfissionalResposta(BaseModel):
    id: uuid.UUID
    email: str

    model_config = {"from_attributes": True}


class CredenciaisClienteAtualizar(BaseModel):
    nickname: str | None = None
    senha: str | None = None


class CredenciaisClienteResposta(BaseModel):
    id: uuid.UUID
    nickname: str | None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Status/trial — mesma capacidade que existia no painel de suporte interno
# (profissionais.is_admin), agora no nível Negócio de verdade, e estendida
# pra clientes também.
# ---------------------------------------------------------------------------


class StatusPlanejadorAtualizar(BaseModel):
    status: str  # 'ativa' | 'congelada' | 'cancelada'


class TrialAtualizar(BaseModel):
    trial_ate: date | None  # None = encerra o teste em andamento


class StatusClienteAtualizar(BaseModel):
    status: str  # 'ativo' | 'excluido'


class PlanejadorClienteAtualizar(BaseModel):
    profissional_id: uuid.UUID  # planejador de destino
