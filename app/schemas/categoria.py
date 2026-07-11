import uuid
from datetime import datetime

from pydantic import BaseModel

CONTEXTOS = {"PF", "PJ", "ambos"}
TIPOS = {"entrada", "saida", "neutra", "investimento"}


class CategoriaResposta(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    icone: str | None = None
    contexto: str = "ambos"
    padrao_sistema: bool
    cliente_id: uuid.UUID | None = None
    # Computado pelo backend conforme quem está perguntando -- evita duplicar
    # a regra de dono (planejador só edita as compartilhadas dele, cliente só
    # edita as próprias) no frontend.
    editavel: bool = False
    criado_em: datetime

    model_config = {"from_attributes": True}


class CategoriaCriar(BaseModel):
    nome: str
    tipo: str
    icone: str | None = None
    contexto: str = "ambos"


class CategoriaAtualizar(BaseModel):
    nome: str | None = None
    icone: str | None = None
    contexto: str | None = None


class SubcategoriaResposta(BaseModel):
    id: uuid.UUID
    categoria_id: uuid.UUID
    nome: str
    padrao_sistema: bool
    cliente_id: uuid.UUID | None = None
    editavel: bool = False
    criado_em: datetime

    model_config = {"from_attributes": True}


class SubcategoriaCriar(BaseModel):
    categoria_id: uuid.UUID
    nome: str


class SubcategoriaAtualizar(BaseModel):
    nome: str
