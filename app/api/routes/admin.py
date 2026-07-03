"""
Painel interno da Fluxo (equipe/suporte) — acesso cross-tenant, restrito a
profissionais com is_admin=true (ver app/api/deps.py::get_profissional_admin_atual).

Toda rota aqui usa get_db_admin (conexão privilegiada, ignora RLS) SÓ depois
de passar pelo gate de get_profissional_admin_atual — nunca isoladamente.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db_admin, get_profissional_admin_atual
from app.models.cliente import Cliente
from app.models.profissional import Profissional

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_profissional_admin_atual)],
)


@router.get("/profissionais")
def listar_profissionais(db: Session = Depends(get_db_admin)):
    profissionais = db.scalars(select(Profissional)).all()
    contagem_clientes = dict(
        db.execute(
            select(Cliente.profissional_id, func.count())
            .where(Cliente.status == "ativo")
            .group_by(Cliente.profissional_id)
        ).all()
    )
    return [
        {
            "id": p.id,
            "nome": p.nome,
            "email": p.email,
            "subdominio": p.subdominio,
            "status": p.status,
            "is_admin": p.is_admin,
            "clientes_ativos": contagem_clientes.get(p.id, 0),
            "criado_em": p.criado_em,
        }
        for p in profissionais
    ]


@router.get("/profissionais/{profissional_id}/clientes")
def listar_clientes_do_profissional(profissional_id: uuid.UUID, db: Session = Depends(get_db_admin)):
    clientes = db.scalars(select(Cliente).where(Cliente.profissional_id == profissional_id)).all()
    return [
        {
            "id": c.id,
            "nome": c.nome,
            "tipo": c.tipo,
            "documento": c.documento,
            "status": c.status,
            "data_cadastro": c.data_cadastro,
            "valor_honorario_mensal": c.valor_honorario_mensal,
        }
        for c in clientes
    ]
