import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class ProfissionalCadastro(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    # Nome da empresa/escritório (usado na marca). O subdomínio é gerado a
    # partir dele no cadastro; pode ser trocado depois na aba Marca.
    nome_empresa: str | None = None
    whatsapp: str | None = None
    # Opcional: se não vier, geramos a partir do nome_empresa/nome.
    subdominio: str | None = None
    # Consentimento LGPD: precisa vir True (aceite dos Termos + Privacidade).
    # A data e a versão aceitas ficam registradas como prova.
    aceite_termos: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfissionalPerfil(BaseModel):
    id: uuid.UUID
    nome: str
    nome_empresa: str | None = None
    whatsapp: str | None = None
    email: EmailStr
    subdominio: str
    status: str
    is_admin: bool
    trial_ate: date | None
    # Marca (white-label)
    cor_marca: str | None = None
    logo_url: str | None = None
    video_boas_vindas: str | None = None
    pode_editar_marca: bool = False
    # Gating de plano (o frontend usa pra decidir travar/liberar o app)
    plano_ativo: bool = False
    tem_assinatura: bool = False
    tipo_plano: str | None = None
    # Vagas de clientes (admin pode conceder mais / preço custom por extra)
    vagas_inclusas: int = 4
    valor_vaga_extra: float | None = None

    model_config = {"from_attributes": True}


# ---------- Marca (white-label) ----------
class MarcaAtualizar(BaseModel):
    nome_empresa: str | None = None
    cor_marca: str | None = None
    subdominio: str | None = None
    video_boas_vindas: str | None = None


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
    # Quando o CPF já teve um cadastro EXCLUÍDO deste planejador: None = ainda
    # não decidiu (a API responde 409 pedindo a escolha); True = reativar o
    # cadastro antigo (recupera histórico); False = começar do zero (novo
    # cadastro, o antigo permanece excluído).
    recuperar_historico: bool | None = None


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
    historico: str | None = None
    situacao_atual: str | None = None
    conjuge_nome: str | None = None
    # Consentimento LGPD: null = ainda não aceitou (mostra a porta de aceite).
    termos_aceitos_em: datetime | None = None
    criado_em: datetime

    model_config = {"from_attributes": True}


class ConjugeAtualizar(BaseModel):
    conjuge_nome: str | None = None


class ClienteSaudeResumo(BaseModel):
    cliente_id: uuid.UUID
    # vermelho | amarelo | verde | azul | neutro (mesma classificação que o
    # cliente vê no termômetro da saúde financeira).
    classificacao: str


class ClienteAtualizar(BaseModel):
    nome: str | None = None
    tipo: str | None = None
    documento: str | None = None
    cnpj: str | None = None
    nome_pj: str | None = None
    valor_honorario_mensal: float | None = None
    perfil_comportamental: str | None = None
    objetivo_principal: str | None = None
    historico: str | None = None
    situacao_atual: str | None = None
    nickname: str | None = None
    senha: str | None = None  # só re-hash se enviado


class ClienteExcluir(BaseModel):
    motivo_churn: str | None = None
    motivo_churn_detalhe: str | None = None


# ---------- Login do cliente final ----------
class ClienteLoginRequest(BaseModel):
    nickname: str
    senha: str
