import uuid
from datetime import datetime

from pydantic import BaseModel

NATUREZAS = {"conta", "cartao"}
CONTEXTOS = {"PF", "PJ", "ambos"}
VISUALIZACOES = {"data_compra", "virada_cartao"}


class ContaCriar(BaseModel):
    natureza: str  # conta | cartao
    nome_exibicao: str
    banco: str | None = None
    saldo_manual: float | None = None  # natureza=conta
    limite_total: float | None = None  # natureza=cartao
    dia_virada: int | None = None  # natureza=cartao, 1-31
    contexto: str = "ambos"  # PF | PJ | ambos
    de_conjuge: bool = False  # True = conta/cartão do cônjuge


class ContaAtualizar(BaseModel):
    nome_exibicao: str | None = None
    banco: str | None = None
    saldo_manual: float | None = None
    limite_total: float | None = None
    dia_virada: int | None = None
    contexto: str | None = None
    de_conjuge: bool | None = None


class ContaResposta(BaseModel):
    id: uuid.UUID
    natureza: str
    contexto: str = "ambos"
    de_conjuge: bool = False
    nome_exibicao: str | None
    banco: str | None
    modo: str
    status: str
    saldo_manual: float | None  # natureza=conta: ajuste/correção somado ao saldo automático
    limite_total: float | None
    dia_virada: int | None
    valor_usado: float = 0  # calculado (natureza=cartao): gasto no mês de referência atual
    saldo_automatico: float = 0  # natureza=conta: soma automática dos lançamentos vinculados
    saldo_atual: float = 0  # natureza=conta: saldo_automatico + ajuste manual (saldo_manual)
    atualizado_em: datetime

    model_config = {"from_attributes": True}


class PreferenciaAtualizar(BaseModel):
    visualizacao_lancamento: str  # data_compra | virada_cartao


class PreferenciaResposta(BaseModel):
    visualizacao_lancamento: str

    model_config = {"from_attributes": True}
