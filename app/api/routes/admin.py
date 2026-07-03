"""
Painel interno da Fluxo (equipe/suporte) — acesso cross-tenant, restrito a
profissionais com is_admin=true (ver app/api/deps.py::get_profissional_admin_atual).

Toda rota aqui usa get_db_admin (conexão privilegiada, ignora RLS) SÓ depois
de passar pelo gate de get_profissional_admin_atual — nunca isoladamente.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.deps import get_db_admin, get_profissional_admin_atual
from app.models.cliente import Cliente
from app.models.fatura import Fatura
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
    # Plano atual = assinatura mais recente por profissional.
    plano_atual = dict(
        db.execute(
            text("""
                SELECT DISTINCT ON (profissional_id) profissional_id, tipo_plano
                FROM assinaturas
                ORDER BY profissional_id, criado_em DESC
            """)
        ).all()
    )

    hoje = date.today()
    return [
        {
            "id": p.id,
            "nome": p.nome,
            "email": p.email,
            "subdominio": p.subdominio,
            "status": p.status,
            "is_admin": p.is_admin,
            "clientes_ativos": contagem_clientes.get(p.id, 0),
            "tipo_plano_atual": plano_atual.get(p.id),
            "trial_ate": p.trial_ate,
            "em_trial": bool(p.trial_ate and p.trial_ate >= hoje),
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


class AtualizarStatusRequest(BaseModel):
    status: str  # 'ativa' | 'congelada' | 'cancelada'


@router.patch("/profissionais/{profissional_id}/status")
def atualizar_status_profissional(
    profissional_id: uuid.UUID,
    dados: AtualizarStatusRequest,
    admin_id: uuid.UUID = Depends(get_profissional_admin_atual),
    db: Session = Depends(get_db_admin),
):
    if dados.status not in ("ativa", "congelada", "cancelada"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="status inválido")

    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profissional não encontrado")

    status_anterior = profissional.status
    profissional.status = dados.status
    db.add(profissional)

    if dados.status in ("congelada", "cancelada"):
        # Pausa as conexões Open Finance ativas dos clientes desse profissional
        # (mesma semântica da régua de inadimplência automatizada, disparada
        # aqui manualmente pelo admin).
        db.execute(
            text("""
                UPDATE contas_conectadas SET status = 'pausada'
                WHERE profissional_id = :pid AND status = 'ativa'
            """),
            {"pid": str(profissional_id)},
        )

    db.execute(
        text("""
            INSERT INTO auditoria_log (profissional_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhe)
            VALUES (:pid, 'profissional', :admin_id, 'ADMIN_STATUS_ALTERADO', 'profissional', :pid,
                    jsonb_build_object('status_anterior', :antes, 'status_novo', :depois))
        """),
        {"pid": str(profissional_id), "admin_id": str(admin_id), "antes": status_anterior, "depois": dados.status},
    )

    db.commit()
    return {"id": profissional_id, "status": dados.status, "status_anterior": status_anterior}


class ConcederTrialRequest(BaseModel):
    trial_ate: date | None  # None = encerra o teste em andamento


@router.patch("/profissionais/{profissional_id}/trial")
def conceder_trial(
    profissional_id: uuid.UUID,
    dados: ConcederTrialRequest,
    admin_id: uuid.UUID = Depends(get_profissional_admin_atual),
    db: Session = Depends(get_db_admin),
):
    profissional = db.get(Profissional, profissional_id)
    if not profissional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profissional não encontrado")

    trial_anterior = profissional.trial_ate
    profissional.trial_ate = dados.trial_ate
    db.add(profissional)

    db.execute(
        text("""
            INSERT INTO auditoria_log (profissional_id, ator_tipo, ator_id, acao, entidade, entidade_id, detalhe)
            VALUES (:pid, 'profissional', :admin_id, 'ADMIN_TRIAL_CONCEDIDO', 'profissional', :pid,
                    jsonb_build_object('trial_anterior', :antes, 'trial_novo', :depois))
        """),
        {
            "pid": str(profissional_id),
            "admin_id": str(admin_id),
            "antes": trial_anterior.isoformat() if trial_anterior else None,
            "depois": dados.trial_ate.isoformat() if dados.trial_ate else None,
        },
    )

    db.commit()
    return {"id": profissional_id, "trial_ate": dados.trial_ate}


@router.get("/metricas")
def metricas_negocio(db: Session = Depends(get_db_admin)):
    total_profissionais = db.scalar(select(func.count()).select_from(Profissional))
    por_status = dict(db.execute(select(Profissional.status, func.count()).group_by(Profissional.status)).all())
    profissionais_em_trial = db.scalar(
        select(func.count())
        .select_from(Profissional)
        .where(Profissional.trial_ate.is_not(None), Profissional.trial_ate >= date.today())
    )

    por_tipo_plano = dict(
        db.execute(
            text("""
                SELECT tipo_plano, COUNT(*) FROM (
                    SELECT DISTINCT ON (profissional_id) profissional_id, tipo_plano
                    FROM assinaturas
                    ORDER BY profissional_id, criado_em DESC
                ) atual
                GROUP BY tipo_plano
            """)
        ).all()
    )

    clientes_ativos_total = db.scalar(select(func.count()).select_from(Cliente).where(Cliente.status == "ativo"))

    # valor_total é GENERATED ALWAYS no banco (não é coluna mapeada no
    # model — é @property em Python), por isso SQL direto aqui em vez de
    # func.sum(Fatura.valor_total).
    total_pago_historico = db.scalar(
        text("SELECT COALESCE(SUM(valor_total), 0) FROM faturas WHERE status = 'paga'")
    )

    ultimo_ciclo = db.scalar(select(func.max(Fatura.ciclo_referencia)))
    receita_ultimo_ciclo = {"ciclo_referencia": ultimo_ciclo, "paga": 0.0, "pendente": 0.0, "atrasada": 0.0}
    if ultimo_ciclo:
        for status_f, soma in db.execute(
            text("SELECT status, SUM(valor_total) FROM faturas WHERE ciclo_referencia = :ciclo GROUP BY status"),
            {"ciclo": ultimo_ciclo},
        ).all():
            receita_ultimo_ciclo[status_f] = float(soma or 0)

    return {
        "profissionais": {
            "total": total_profissionais,
            "ativa": por_status.get("ativa", 0),
            "congelada": por_status.get("congelada", 0),
            "cancelada": por_status.get("cancelada", 0),
            "em_trial": profissionais_em_trial,
        },
        "planos_vendidos": {
            "total": sum(por_tipo_plano.values()),
            "essencial": por_tipo_plano.get("essencial", 0),
            "completo": por_tipo_plano.get("completo", 0),
        },
        "clientes_ativos_total": clientes_ativos_total,
        "faturamento": {
            "total_pago_historico": float(total_pago_historico or 0),
            "ultimo_ciclo": receita_ultimo_ciclo,
        },
    }


@router.get("/metricas/serie-temporal")
def metricas_serie_temporal(db: Session = Depends(get_db_admin)):
    """Dados pra gráfico: novos profissionais por mês e receita paga por
    ciclo de faturamento. Retorna os dados brutos — o gráfico em si é
    responsabilidade do frontend (ainda não construído)."""
    cadastros = db.execute(
        text("""
            SELECT date_trunc('month', criado_em)::date AS mes, COUNT(*) AS total
            FROM profissionais
            GROUP BY 1 ORDER BY 1
        """)
    ).all()
    receita = db.execute(
        text("""
            SELECT ciclo_referencia, SUM(valor_total) AS total
            FROM faturas
            WHERE status = 'paga'
            GROUP BY ciclo_referencia ORDER BY ciclo_referencia
        """)
    ).all()
    return {
        "novos_profissionais_por_mes": [{"mes": str(mes), "total": total} for mes, total in cadastros],
        "receita_paga_por_ciclo": [
            {"ciclo_referencia": str(ciclo), "total": float(total)} for ciclo, total in receita
        ],
    }
