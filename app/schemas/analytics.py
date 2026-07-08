import uuid

from pydantic import BaseModel


class TopClienteResposta(BaseModel):
    cliente_id: uuid.UUID
    nome: str
    tipo: str
    tem_pj: bool = False  # cliente também tem contexto PJ (CNPJ cadastrado)
    valor_honorario_mensal: float | None
    meses_relacionamento: float | None
    ltv_realizado: float | None


class MetricasCarteiraResposta(BaseModel):
    clientes_ativos: int
    clientes_churned: int
    taxa_churn_pct: float | None
    ticket_medio: float | None
    ltv_medio_realizado: float | None
    ltv_projetado: float | None
    top_clientes: list[TopClienteResposta]
