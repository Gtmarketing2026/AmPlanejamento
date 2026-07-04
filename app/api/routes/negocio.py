"""
Nível "Negócio" — admin dono/operador da plataforma Fluxo (tabela `admins`,
separada de `profissionais`). Ver CLAUDE.md, seção "Três níveis de acesso".

Login é independente do login de profissional (app/api/routes/auth.py) e do
de cliente final (app/api/routes/clientes.py): tabela própria, JWT com
tipo="admin", nunca aceito nas rotas dos outros dois níveis e vice-versa.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.deps import get_db_negocio, get_db_sem_rls
from app.core.security import criar_access_token, verificar_senha
from app.models.admin import Admin
from app.models.cliente import Cliente
from app.models.profissional import Profissional
from app.schemas.cliente import LoginRequest, TokenResponse
from app.schemas.negocio import ClienteDoPlanejadorResposta, MetricasNegocioResposta, PlanejadorResposta

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
