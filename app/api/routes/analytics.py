"""
Painel analítico do profissional — visão agregada da própria carteira,
usando as views vw_metricas_carteira e vw_retencao_clientes (ver
schema_seguranca.sql).

Filtro explícito por profissional_id (vindo do token) em toda query, além
do RLS: as views podem rodar como o dono (postgres, BYPASSRLS) dependendo do
security_invoker, então o WHERE explícito é o que garante o isolamento de
tenant aqui — nunca confiar só no RLS pra views.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.schemas.analytics import MetricasCarteiraResposta

router = APIRouter(tags=["analytics"])


@router.get("/metricas-carteira", response_model=MetricasCarteiraResposta)
def metricas_carteira(
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    linha = db.execute(
        text("SELECT * FROM vw_metricas_carteira WHERE profissional_id = :pid"),
        {"pid": str(profissional_id)},
    ).mappings().first()

    kpis = dict(linha) if linha else {
        "clientes_ativos": 0, "clientes_churned": 0, "taxa_churn_pct": None,
        "ticket_medio": None, "ltv_medio_realizado": None, "ltv_projetado": None,
    }

    top = db.execute(
        text("""
            SELECT r.cliente_id, r.nome, r.tipo, r.valor_honorario_mensal,
                   r.meses_relacionamento, r.ltv_realizado,
                   (c.cnpj IS NOT NULL AND c.cnpj <> '') AS tem_pj
            FROM vw_retencao_clientes r
            LEFT JOIN clientes c ON c.id = r.cliente_id
            WHERE r.profissional_id = :pid AND r.status = 'ativo'
            ORDER BY r.ltv_realizado DESC NULLS LAST
            LIMIT 10
        """),
        {"pid": str(profissional_id)},
    ).mappings().all()

    return {
        "clientes_ativos": kpis.get("clientes_ativos") or 0,
        "clientes_churned": kpis.get("clientes_churned") or 0,
        "taxa_churn_pct": kpis.get("taxa_churn_pct"),
        "ticket_medio": kpis.get("ticket_medio"),
        "ltv_medio_realizado": kpis.get("ltv_medio_realizado"),
        "ltv_projetado": kpis.get("ltv_projetado"),
        "top_clientes": [dict(r) for r in top],
    }
