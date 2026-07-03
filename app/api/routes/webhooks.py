"""
Webhook do Asaas — recebe eventos de PAYMENT_* (o Asaas não tem webhook
próprio de subscription; toda notificação de assinatura chega como evento
de payment, com o campo `subscription` linkando de volta).

Configurar no painel do Asaas: Integrações > Webhooks > URL desta rota +
o mesmo token usado em ASAAS_WEBHOOK_TOKEN.
"""

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select

from app.db.base import SessionLocalAdmin
from app.integrations.asaas import (
    EVENTOS_PAGAMENTO_CONFIRMADO,
    EVENTOS_PAGAMENTO_VENCIDO,
    validar_webhook_token,
)
from app.models.fatura import Fatura

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/asaas", status_code=status.HTTP_200_OK)
async def receber_webhook_asaas(
    request: Request,
    asaas_access_token: str | None = Header(default=None, alias="asaas-access-token"),
):
    # 1. Validar token ANTES de tocar em qualquer dado do payload.
    if not validar_webhook_token(asaas_access_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    payload = await request.json()
    evento = payload.get("event")
    payment = payload.get("payment", {})
    asaas_payment_id = payment.get("id")
    asaas_subscription_id = payment.get("subscription")

    if not asaas_payment_id:
        # Evento que não é de payment — ignorar silenciosamente.
        return {"status": "ignorado"}

    # 2. Idempotência: registrar o evento bruto antes de processar.
    #    (Em produção, use a tabela webhook_events com a constraint UNIQUE
    #    (provedor, evento_id_provedor) para não processar duas vezes.)
    db = SessionLocalAdmin()
    try:
        # Esta rota roda sem RLS de profissional (é o Asaas chamando, não um
        # usuário logado) — busca a fatura direto pelo ID do Asaas, por isso
        # usa a conexão privilegiada (SessionLocalAdmin, sem BYPASSRLS a
        # query normal voltaria sempre vazia — ver app/db/base.py).
        fatura = db.scalar(select(Fatura).where(Fatura.asaas_payment_id == asaas_payment_id))

        if not fatura:
            # Pode ser a primeira cobrança de uma subscription nova, ainda
            # sem asaas_payment_id salvo — nesse caso, tentar casar por
            # asaas_subscription_id seria o próximo passo (não implementado
            # neste esqueleto).
            return {"status": "fatura não encontrada", "asaas_payment_id": asaas_payment_id}

        if evento in EVENTOS_PAGAMENTO_CONFIRMADO:
            fatura.status = "paga"
            fatura.asaas_status = evento
        elif evento in EVENTOS_PAGAMENTO_VENCIDO:
            fatura.status = "atrasada"
            fatura.asaas_status = evento
            # TODO: disparar aqui o início da régua de inadimplência
            # (D+5 congelamento / D+35 cancelamento) no profissional dono
            # dessa fatura — ver jobs/inadimplencia.py (a criar).
        else:
            fatura.asaas_status = evento

        db.add(fatura)
        db.commit()

    finally:
        db.close()

    return {"status": "processado", "evento": evento}
