"""
Nível "Negócio" — admin dono/operador da plataforma Fluxo (tabela `admins`,
separada de `profissionais`). Ver CLAUDE.md, seção "Três níveis de acesso".

Login é independente do login de profissional (app/api/routes/auth.py) e do
de cliente final (app/api/routes/clientes.py): tabela própria, JWT com
tipo="admin", nunca aceito nas rotas dos outros dois níveis e vice-versa.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import get_admin_id_atual, get_db_negocio, get_db_sem_rls
from app.core.security import criar_access_token, hash_senha, verificar_senha
from app.models.admin import Admin
from app.models.cliente import Cliente
from app.models.despesa_operacional import DespesaOperacional
from app.models.profissional import Profissional
from app.models.transacao import Transacao
from app.schemas.cliente import LoginRequest, TokenResponse
from app.schemas.negocio import (
    AdminAtualizar,
    AdminPerfilResposta,
    ClienteDoPlanejadorResposta,
    CredenciaisClienteAtualizar,
    CredenciaisClienteResposta,
    CredenciaisProfissionalAtualizar,
    CredenciaisProfissionalResposta,
    DespesaCriar,
    DespesaResposta,
    FaturaPlataformaResposta,
    MetricasNegocioResposta,
    PlanejadorResposta,
    TransacaoNegocioResposta,
)

router = APIRouter(prefix="/negocio", tags=["negocio"])


@router.post("/login", response_model=TokenResponse)
def login_admin(dados: LoginRequest, db: Session = Depends(get_db_sem_rls)):
    # get_db_sem_rls usa a conexão privilegiada -- necessário aqui porque o
    # login busca por e-mail sem ainda ter nenhum contexto de RLS (mesma
    # razão do login de profissional/cliente final).
    admin = db.scalar(select(Admin).where(Admin.email == dados.email))
    if not admin or not verificar_senha(dados.senha, admin.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos")

    token = criar_access_token(str(admin.id), tipo="admin")
    return TokenResponse(access_token=token)


@router.get("/perfil", response_model=AdminPerfilResposta)
def perfil_admin(
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
    db: Session = Depends(get_db_negocio),
):
    admin = db.get(Admin, admin_id)
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin não encontrado")
    return admin


@router.patch("/perfil", response_model=AdminPerfilResposta)
def atualizar_perfil_admin(
    dados: AdminAtualizar,
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
    db: Session = Depends(get_db_negocio),
):
    """O admin edita a própria senha e/ou e-mail de login (nível Negócio)."""
    admin = db.get(Admin, admin_id)
    if not admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin não encontrado")

    dados_informados = dados.model_dump(exclude_unset=True)

    novo_email = dados_informados.pop("email", None)
    if novo_email and novo_email != admin.email:
        ja_existe = db.scalar(select(Admin).where(Admin.email == novo_email, Admin.id != admin_id))
        if ja_existe:
            raise HTTPException(status_code=400, detail="E-mail já está em uso")
        admin.email = novo_email

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
        admin.senha_hash = hash_senha(nova_senha)

    for campo, valor in dados_informados.items():
        setattr(admin, campo, valor)

    db.add(admin)
    db.flush()
    db.refresh(admin)
    return admin


@router.get("/metricas", response_model=MetricasNegocioResposta)
def metricas_negocio(db: Session = Depends(get_db_negocio)):
    linha = db.execute(text("SELECT * FROM vw_metricas_negocio")).mappings().first()
    return dict(linha)


@router.get("/planejadores", response_model=list[PlanejadorResposta])
def listar_planejadores(db: Session = Depends(get_db_negocio)):
    # bypass de app.is_admin já ativo nesta conexão (get_db_negocio) -- por
    # isso o SELECT abaixo enxerga profissionais de TODOS os tenants, mesmo
    # sem current_profissional_id setado.
    linhas = db.execute(
        text("""
            SELECT
                p.id, p.nome, p.email, p.subdominio, p.status, p.criado_em,
                atual.tipo_plano AS tipo_plano_atual,
                COALESCE(qtd.clientes_ativos, 0) AS clientes_ativos,
                COALESCE(ultimo.mrr_contribuido, 0) AS mrr_contribuido
            FROM profissionais p
            LEFT JOIN LATERAL (
                SELECT tipo_plano FROM assinaturas
                WHERE profissional_id = p.id ORDER BY criado_em DESC LIMIT 1
            ) atual ON true
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS clientes_ativos FROM clientes
                WHERE profissional_id = p.id AND status = 'ativo'
            ) qtd ON true
            LEFT JOIN LATERAL (
                SELECT (valor_base + valor_extras) AS mrr_contribuido FROM faturas
                WHERE profissional_id = p.id ORDER BY ciclo_referencia DESC LIMIT 1
            ) ultimo ON true
            ORDER BY p.criado_em DESC
        """)
    ).mappings().all()
    return [dict(linha) for linha in linhas]


@router.get("/planejadores/{profissional_id}/clientes", response_model=list[ClienteDoPlanejadorResposta])
def listar_clientes_do_planejador(profissional_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planejador não encontrado")

    clientes = db.scalars(select(Cliente).where(Cliente.profissional_id == profissional_id)).all()
    return clientes


@router.patch("/planejadores/{profissional_id}/credenciais", response_model=CredenciaisProfissionalResposta)
def atualizar_credenciais_planejador(
    profissional_id: uuid.UUID, dados: CredenciaisProfissionalAtualizar, db: Session = Depends(get_db_negocio)
):
    """Suporte: admin reseta e-mail/senha de login de um planejador (ex: ele
    esqueceu a senha ou perdeu acesso ao e-mail). Bypass de RLS já ativo
    nesta conexão (get_db_negocio) -- enxerga qualquer profissional."""
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planejador não encontrado")

    dados_informados = dados.model_dump(exclude_unset=True)

    novo_email = dados_informados.pop("email", None)
    if novo_email and novo_email != profissional.email:
        ja_existe = db.scalar(
            select(Profissional).where(Profissional.email == novo_email, Profissional.id != profissional_id)
        )
        if ja_existe:
            raise HTTPException(status_code=400, detail="E-mail já está em uso")
        profissional.email = novo_email

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
        profissional.senha_hash = hash_senha(nova_senha)

    db.add(profissional)
    db.flush()
    db.refresh(profissional)
    return profissional


@router.patch("/clientes/{cliente_id}/credenciais", response_model=CredenciaisClienteResposta)
def atualizar_credenciais_cliente(
    cliente_id: uuid.UUID, dados: CredenciaisClienteAtualizar, db: Session = Depends(get_db_negocio)
):
    """Mesma ideia, pro cliente final: admin reseta nickname/senha de login
    sem precisar acionar o planejador dele."""
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    dados_informados = dados.model_dump(exclude_unset=True)

    novo_nickname = dados_informados.pop("nickname", None)
    if novo_nickname and novo_nickname != cliente.nickname:
        ja_existe = db.scalar(select(Cliente).where(Cliente.nickname == novo_nickname, Cliente.id != cliente_id))
        if ja_existe:
            raise HTTPException(status_code=400, detail="Nickname já está em uso")
        cliente.nickname = novo_nickname

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
        cliente.senha_hash = hash_senha(nova_senha)

    db.add(cliente)
    db.flush()
    db.refresh(cliente)
    return cliente


@router.get("/clientes/{cliente_id}/transacoes", response_model=list[TransacaoNegocioResposta])
def transacoes_do_cliente(cliente_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    """Drill-down do nível Negócio até um cliente específico — o admin vê os
    lançamentos dele (só leitura) via bypass de RLS, sem precisar do login do
    planejador nem do cliente."""
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    return db.scalars(
        select(Transacao).where(Transacao.cliente_id == cliente_id).order_by(Transacao.data.desc())
    ).all()


# ---------------------------------------------------------------------------
# Financeiro da Plataforma — cobrança recebida dos planejadores + custos do
# próprio negócio Fluxo (despesas_operacionais).
# ---------------------------------------------------------------------------


@router.get("/financeiro/faturas", response_model=list[FaturaPlataformaResposta])
def faturas_da_plataforma(db: Session = Depends(get_db_negocio)):
    linhas = db.execute(
        text("""
            SELECT f.id, f.profissional_id, p.nome AS planejador_nome,
                   f.ciclo_referencia, (f.valor_base + f.valor_extras) AS valor_total, f.status
            FROM faturas f
            JOIN profissionais p ON p.id = f.profissional_id
            ORDER BY f.ciclo_referencia DESC, p.nome
        """)
    ).mappings().all()
    return [dict(linha) for linha in linhas]


@router.get("/despesas", response_model=list[DespesaResposta])
def listar_despesas(db: Session = Depends(get_db_negocio)):
    return db.scalars(select(DespesaOperacional).order_by(DespesaOperacional.data.desc())).all()


@router.post("/despesas", response_model=DespesaResposta, status_code=status.HTTP_201_CREATED)
def criar_despesa(dados: DespesaCriar, db: Session = Depends(get_db_negocio)):
    categorias_validas = {
        "infraestrutura", "gateway_pagamento", "open_finance",
        "marketing", "ferramentas", "pessoal", "outro",
    }
    if dados.categoria not in categorias_validas:
        raise HTTPException(status_code=422, detail="categoria inválida")

    despesa = DespesaOperacional(
        descricao=dados.descricao,
        categoria=dados.categoria,
        valor=dados.valor,
        data=dados.data or date.today(),
    )
    db.add(despesa)
    db.flush()
    db.refresh(despesa)
    return despesa


@router.delete("/despesas/{despesa_id}", status_code=status.HTTP_200_OK)
def excluir_despesa(despesa_id: uuid.UUID, db: Session = Depends(get_db_negocio)):
    despesa = db.get(DespesaOperacional, despesa_id)
    if not despesa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despesa não encontrada")
    db.delete(despesa)
    db.flush()
    return {"ok": True}
