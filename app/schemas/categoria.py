import uuid
from datetime import datetime

from pydantic import BaseModel


class CategoriaResposta(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    padrao_sistema: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class SubcategoriaResposta(BaseModel):
    id: uuid.UUID
    categoria_id: uuid.UUID
    nome: str
    padrao_sistema: bool
    criado_em: datetime

    model_config = {"from_attributes": True}
