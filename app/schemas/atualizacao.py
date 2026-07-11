import uuid
from datetime import datetime

from pydantic import BaseModel


# ---------- Autoria (nível Negócio / plataforma) ----------
class AtualizacaoCriar(BaseModel):
    titulo: str
    descricao: str
    tipo: str = "novidade"  # novidade | melhoria | correcao
    publico: str = "ambos"  # cliente | planejador | ambos
    publicado: bool = False


class AtualizacaoAtualizar(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    tipo: str | None = None
    publico: str | None = None
    publicado: bool | None = None


class AtualizacaoResposta(BaseModel):
    id: uuid.UUID
    titulo: str
    descricao: str
    tipo: str
    publico: str
    publicado: bool
    criado_em: datetime
    publicado_em: datetime | None

    model_config = {"from_attributes": True}


# ---------- Exibição (cliente final / planejador) ----------
class NovidadeResposta(BaseModel):
    id: uuid.UUID
    titulo: str
    descricao: str
    tipo: str
    publicado_em: datetime | None
    nao_lida: bool


class NovidadesResposta(BaseModel):
    nao_lidas: int
    itens: list[NovidadeResposta]
