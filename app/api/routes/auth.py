import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_db_sem_rls, get_profissional_id_atual
from app.core.config import settings
from app.core.planos import tem_plano_ativo
from app.core.security import criar_access_token, hash_senha, verificar_senha
from app.models.assinatura import Assinatura
from app.models.profissional import Profissional
from app.schemas.cliente import LoginRequest, ProfissionalCadastro, ProfissionalPerfil, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _gerar_subdominio(db: Session, base_texto: str) -> str:
    """Gera um subdomínio único a partir do nome da empresa/nome do
    profissional (o usuário não digita mais o subdomínio no cadastro; ele
    ajusta depois na aba Marca). Slug simples: só letras/números."""
    import re

    base = re.sub(r"[^a-z0-9]", "", (base_texto or "").lower())[:30] or "planejador"
    sub = base
    i = 1
    while db.scalar(select(Profissional).where(Profissional.subdominio == sub)):
        i += 1
        sub = f"{base}{i}"
    return sub


@router.post("/cadastro", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_profissional(dados: ProfissionalCadastro, db: Session = Depends(get_db_sem_rls)):
    from datetime import timedelta

    ja_existe = db.scalar(select(Profissional).where(Profissional.email == dados.email))
    if ja_existe:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    # Subdomínio: se veio explícito, respeita (e valida unicidade); senão gera
    # a partir do nome da empresa/nome.
    if dados.subdominio:
        if db.scalar(select(Profissional).where(Profissional.subdominio == dados.subdominio)):
            raise HTTPException(status_code=400, detail="Subdomínio já está em uso")
        subdominio = dados.subdominio
    else:
        subdominio = _gerar_subdominio(db, dados.nome_empresa or dados.nome)

    profissional = Profissional(
        nome=dados.nome,
        nome_empresa=dados.nome_empresa,
        whatsapp=dados.whatsapp,
        email=dados.email,
        senha_hash=hash_senha(dados.senha),
        subdominio=subdominio,
        # Trial de 7 dias já no cadastro: o planejador consegue testar o produto
        # antes de escolher/pagar um plano (ver core/planos.py::tem_plano_ativo).
        trial_ate=date.today() + timedelta(days=settings.TRIAL_DIAS),
    )
    db.add(profissional)
    db.commit()
    db.refresh(profissional)

    token = criar_access_token(str(profissional.id))

    # Durante o trial o planejador já usa o produto. A criação do
    # customer/subscription no Asaas + Assinatura + primeira Fatura acontece
    # quando ele ESCOLHE um plano em POST /assinatura/escolher-plano
    # (app/api/routes/assinatura.py), não aqui.
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(dados: LoginRequest, db: Session = Depends(get_db_sem_rls)):
    profissional = db.scalar(select(Profissional).where(Profissional.email == dados.email))
    if not profissional or not verificar_senha(dados.senha, profissional.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    if profissional.status == "cancelada":
        raise HTTPException(status_code=403, detail="Assinatura cancelada. Entre em contato com o suporte.")

    token = criar_access_token(str(profissional.id))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=ProfissionalPerfil)
def perfil_atual(
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    # RLS libera essa leitura mesmo pela conexão restrita: a policy
    # isolar_profissional permite ver a PRÓPRIA linha (id = tenant atual).
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profissional não encontrado")

    assinatura = db.scalar(select(Assinatura).where(Assinatura.profissional_id == profissional_id))
    return ProfissionalPerfil(
        id=profissional.id,
        nome=profissional.nome,
        email=profissional.email,
        subdominio=profissional.subdominio,
        status=profissional.status,
        is_admin=profissional.is_admin,
        trial_ate=profissional.trial_ate,
        plano_ativo=tem_plano_ativo(db, profissional),
        tem_assinatura=assinatura is not None,
        tipo_plano=assinatura.tipo_plano if assinatura else None,
    )
