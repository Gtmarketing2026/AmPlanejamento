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
    # Gating de plano (o frontend usa pra decidir travar/liberar o app)
    plano_ativo: bool = False
    tem_assinatura: bool = False
    tipo_plano: str | None = None

    model_config = {"from_attributes": True}


# ---------- Clientes ----------
class ClienteCriar(BaseModel):
    nome: str
    tipo: str  # 'PF' | 'PJ' (tipo principal)
    documento: str  # CPF, sempre obrigatório
    cnpj: str | None = None  # contexto PJ opcional (ex: Marina PF + Castro Design PJ)
    nome_pj: str | None = None
    valor_honorario_mensal: float | None = None
    # Contexto CRM (editável depois na aba CRM também)
    perfil_comportamental: str | None = None  # ex: Cauteloso, Arrojado, Disciplinado
    objetivo_principal: str | None = None
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
    perfil_comportamental: str | None
    objetivo_principal: str | None
    criado_em: datetime

    model_config = {"from_attributes": True}


class ClienteAtualizar(BaseModel):
    nome: str | None = None
    tipo: str | None = None
    documento: str | None = None
    cnpj: str | None = None
    nome_pj: str | None = None
    valor_honorario_mensal: float | None = None
    perfil_comportamental: str | None = None
    objetivo_principal: str | None = None
    nickname: str | None = None
    senha: str | None = None  # só re-hash se enviado


class ClienteExcluir(BaseModel):
    motivo_churn: str | None = None
    motivo_churn_detalhe: str | None = None


# ---------- Login do cliente final ----------
class ClienteLoginRequest(BaseModel):
    nickname: str
    senha: str
