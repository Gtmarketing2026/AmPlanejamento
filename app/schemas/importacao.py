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
    # Se true, aplica a mesma categoria/subcategoria a todos os lançamentos
    # do cliente com a mesma descrição (ex: reclassificar "UBER" uma vez e
    # já valer pra todos os "UBER" existentes).
    aplicar_a_todos_iguais: bool = False


class TransacaoCriar(BaseModel):
    """Lançamento manual (não veio de importação de arquivo) -- ex: o
    cliente digitando um gasto em dinheiro na hora."""

    data: date
    descricao: str
    valor: float
    tipo: str  # entrada | saida
    categoria_id: uuid.UUID | None = None
    subcategoria_id: uuid.UUID | None = None
    conta_conectada_id: uuid.UUID | None = None


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
    conta_conectada_id: uuid.UUID | None = None
    mes_referencia: date | None = None
    criado_em: datetime
    # Só preenchido quando a reclassificação usou aplicar_a_todos_iguais --
    # quantos outros lançamentos também foram atualizados junto.
    quantidade_atualizada: int | None = None

    model_config = {"from_attributes": True}
