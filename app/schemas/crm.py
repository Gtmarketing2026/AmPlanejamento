import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

TIPOS_INTERACAO = {"reuniao", "mensagem", "alerta_automatico", "onboarding", "nota"}


class InteracaoCriar(BaseModel):
    tipo: str = Field(default="nota")
    titulo: str
    descricao: str | None = None
    data_interacao: datetime | None = None


class InteracaoResposta(BaseModel):
    id: uuid.UUID
    cliente_id: uuid.UUID
    tipo: str
    titulo: str
    descricao: str | None
    ator_tipo: str
    data_interacao: datetime
    criado_em: datetime

    model_config = {"from_attributes": True}


class FollowUpCriar(BaseModel):
    data_prevista: date
    observacao: str | None = None
    sincronizar_google: bool = False


class FollowUpAtualizar(BaseModel):
    concluido: bool | None = None
    data_prevista: date | None = None
    observacao: str | None = None


class FollowUpResposta(BaseModel):
    id: uuid.UUID
    cliente_id: uuid.UUID
    cliente_nome: str | None = None
    data_prevista: date
    observacao: str | None
    concluido: bool
    concluido_em: datetime | None
    sincronizado_google: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class TarefaCriar(BaseModel):
    titulo: str
    descricao: str | None = None
    prazo: date | None = None


class TarefaAtualizar(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    prazo: date | None = None
    concluido: bool | None = None


class TarefaConcluir(BaseModel):
    concluido: bool


class TarefaResposta(BaseModel):
    id: uuid.UUID
    cliente_id: uuid.UUID
    titulo: str
    descricao: str | None
    prazo: date | None
    concluido: bool
    concluido_em: datetime | None
    criado_em: datetime

    model_config = {"from_attributes": True}


class GoogleStatusResposta(BaseModel):
    configurado: bool  # há GOOGLE_CLIENT_ID/SECRET no servidor
    conectado: bool  # este profissional já autorizou uma conta Google
    email_google: str | None = None


class GoogleAuthUrlResposta(BaseModel):
    url: str
