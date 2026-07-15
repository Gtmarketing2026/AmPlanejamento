from pydantic import BaseModel


class PluggyStatusResposta(BaseModel):
    ativo: bool


class ConnectTokenResposta(BaseModel):
    access_token: str


class SyncPedido(BaseModel):
    item_id: str


class SyncResposta(BaseModel):
    banco: str
    contas: int
    importadas: int
    duplicadas: int
