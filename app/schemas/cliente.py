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


class ProfissionalPerfil(BaseModel):
    id: uuid.UUID
    nome: str
    email: EmailStr
    subdominio: str
    status: str
    is_admin: bool
    trial_ate: date | None

    model_config = {"from_attributes": True}


# ---------- Clientes ----------
class ClienteCriar(BaseModel):
    nome: str
    tipo: str  # 'PF' | 'PJ' (tipo principal)
    documento: str  # CPF, sempre obrigatório
    cnpj: str | None = None  # contexto PJ opcional (ex: Marina PF + Castro Design PJ)
    nome_pj: str | None = None
    valor_honorario_mensal: float | None = None
    nickname: str  # login do cliente final
    senha: str


class ClienteResposta(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    documento: str
    cnpj: str | None
    nome_pj: str | None
    nickname: str | None
    status: str
    data_cadastro: date
    valor_honorario_mensal: float | None
    criado_em: datetime

    model_config = {"from_attributes": True}


class ClienteExcluir(BaseModel):
    motivo_churn: str | None = None
    motivo_churn_detalhe: str | None = None


# ---------- Login do cliente final ----------
class ClienteLoginRequest(BaseModel):
    nickname: str
    senha: str
