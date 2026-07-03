from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_sem_rls
from app.core.security import criar_access_token, hash_senha, verificar_senha
from app.models.profissional import Profissional
from app.schemas.cliente import LoginRequest, ProfissionalCadastro, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/cadastro", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_profissional(dados: ProfissionalCadastro, db: Session = Depends(get_db_sem_rls)):
    ja_existe = db.scalar(select(Profissional).where(Profissional.email == dados.email))
    if ja_existe:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")

    subdominio_em_uso = db.scalar(
        select(Profissional).where(Profissional.subdominio == dados.subdominio)
    )
    if subdominio_em_uso:
        raise HTTPException(status_code=400, detail="Subdomínio já está em uso")

    profissional = Profissional(
        nome=dados.nome,
        email=dados.email,
        senha_hash=hash_senha(dados.senha),
        subdominio=dados.subdominio,
    )
    db.add(profissional)
    db.commit()
    db.refresh(profissional)

    token = criar_access_token(str(profissional.id))

    # TODO: neste ponto também é necessário:
    #   1. Criar o customer no Asaas: asaas.criar_customer(nome, email, cpf_cnpj)
    #   2. Criar o registro de Assinatura (ainda não existe nesta rota — hoje
    #      só o Profissional é criado) com asaas_customer_id preenchido
    #   3. Só então redirecionar pro checkout/coleta de forma de pagamento
    # Não implementado neste esqueleto porque depende de decidir o fluxo de
    # seleção de plano (Essencial/Completo) na tela de cadastro — ver
    # fluxo-app.html tela 1 e 7 (Onboarding) pra referência de UX.
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
