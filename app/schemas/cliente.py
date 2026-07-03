import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class ProfissionalCadastro(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    subdominio: str


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Clientes ----------
class ClienteCriar(BaseModel):
    nome: str
    tipo: str  # 'PF' | 'PJ'
    documento: str
    valor_honorario_mensal: float | None = None


class ClienteResposta(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    documento: str
    status: str
    data_cadastro: date
    valor_honorario_mensal: float | None
    criado_em: datetime

    model_config = {"from_attributes": True}


class ClienteExcluir(BaseModel):
    motivo_churn: str | None = None
    motivo_churn_detalhe: str | None = None
