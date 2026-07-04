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


class PlanejadorResposta(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    subdominio: str
    status: str
    tipo_plano_atual: str | None
    clientes_ativos: int
    mrr_contribuido: float
    criado_em: datetime


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
    criado_em: datetime

    model_config = {"from_attributes": True}


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
