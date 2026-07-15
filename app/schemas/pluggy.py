from pydantic import BaseModel


class PluggyStatusResposta(BaseModel):
    ativo: bool


class ConnectTokenResposta(BaseModel):
    access_token: str
