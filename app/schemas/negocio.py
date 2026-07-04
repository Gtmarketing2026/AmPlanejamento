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
    status: str
    data_cadastro: date
    valor_honorario_mensal: float | None
