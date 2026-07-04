import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ImportacaoResposta(BaseModel):
    id: uuid.UUID
    cliente_id: uuid.UUID
    tipo_documento: str
    formato_arquivo: str
    periodo_inicio: date | None
    periodo_fim: date | None
    status: str
    transacoes_importadas: int
    transacoes_duplicadas: int
    erro_detalhe: str | None
    criado_em: datetime
    processado_em: datetime | None

    model_config = {"from_attributes": True}


class TransacaoAtualizar(BaseModel):
    categoria_id: uuid.UUID | None = None
    subcategoria_id: uuid.UUID | None = None


class TransacaoResposta(BaseModel):
    id: uuid.UUID
    data: date
    descricao: str
    valor: float
    tipo: str
    origem: str
    conciliado: bool
    categoria_id: uuid.UUID | None
    subcategoria_id: uuid.UUID | None
    importacao_id: uuid.UUID | None
    criado_em: datetime

    model_config = {"from_attributes": True}
