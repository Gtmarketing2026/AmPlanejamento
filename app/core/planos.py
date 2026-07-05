"""
Definição dos planos e helper de "plano ativo" (gating).

Um planejador só pode USAR o app (cadastrar cliente etc.) se tiver plano
ativo. "Ativo" = está em período de teste concedido pelo admin (trial_ate no
futuro) OU já pagou pelo menos uma fatura da assinatura. Cadastrar sem plano
é permitido (captura a lead), mas nada além disso funciona até pagar.
"""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fatura import Fatura

PLANOS = {
    "essencial": {
        "tipo_plano": "essencial",
        "nome": "Plano Essencial",
        "valor_base": settings.PLANO_ESSENCIAL_VALOR_BASE,
        "valor_por_extra": settings.PLANO_ESSENCIAL_VALOR_EXTRA,
        "clientes_inclusos": settings.CLIENTES_INCLUSOS_PLANO_BASE,
    },
    "completo": {
        "tipo_plano": "completo",
        "nome": "Plano Completo",
        "valor_base": settings.PLANO_COMPLETO_VALOR_BASE,
        "valor_por_extra": settings.PLANO_COMPLETO_VALOR_EXTRA,
        "clientes_inclusos": settings.CLIENTES_INCLUSOS_PLANO_BASE,
    },
}


def tem_plano_ativo(db: Session, profissional) -> bool:
    """profissional: instância do model Profissional (precisa de trial_ate).
    db: sessão já com contexto de RLS do próprio profissional (as faturas dele)."""
    if profissional.trial_ate and profissional.trial_ate >= date.today():
        return True
    fatura_paga = db.scalar(
        select(Fatura.id).where(Fatura.profissional_id == profissional.id, Fatura.status == "paga").limit(1)
    )
    return fatura_paga is not None
