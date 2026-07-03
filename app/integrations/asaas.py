"""
Cliente da API do Asaas (gateway de pagamento).

Documentação oficial: https://docs.asaas.com

Conceitos-chave usados aqui:
- Customer (cliente no Asaas) — 1 por profissional, criado uma única vez
- Subscription (assinatura) — cobrança recorrente vinculada a um customer.
  O Asaas gera as cobranças (payments) automaticamente a cada ciclo; não
  criamos payment manualmente para o ciclo recorrente.
- Payment — cada cobrança individual gerada pela subscription. É o que
  rastreamos em `faturas.asaas_payment_id`.
- Assinaturas no Asaas NÃO têm webhook próprio — o webhook é sempre de
  PAYMENT_*, e cada payment carrega o campo `subscription` linkando de volta.

Nunca armazenamos dados de cartão aqui — o Asaas lida com isso via link de
pagamento ou checkout transparente; só guardamos os IDs que ele retorna.
"""

import hashlib
import hmac
from typing import Any

import requests

from app.core.config import settings

BASE_URL = (
    "https://api-sandbox.asaas.com/v3"
    if settings.ASAAS_ENV == "sandbox"
    else "https://api.asaas.com/v3"
)


def _headers() -> dict:
    return {
        "access_token": settings.ASAAS_API_KEY,
        "Content-Type": "application/json",
    }


def _post(path: str, payload: dict) -> dict:
    resp = requests.post(f"{BASE_URL}{path}", json=payload, headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def _get(path: str, params: dict | None = None) -> dict:
    resp = requests.get(f"{BASE_URL}{path}", params=params, headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def _put(path: str, payload: dict) -> dict:
    resp = requests.put(f"{BASE_URL}{path}", json=payload, headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def _delete(path: str) -> dict:
    resp = requests.delete(f"{BASE_URL}{path}", headers=_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------
def criar_customer(nome: str, email: str, cpf_cnpj: str, telefone: str | None = None) -> str:
    """Cria o customer no Asaas e retorna o asaas_customer_id.
    Deve ser chamado apenas uma vez por profissional — se já existir,
    reutilize o ID salvo em assinaturas.asaas_customer_id."""
    payload = {
        "name": nome,
        "email": email,
        "cpfCnpj": cpf_cnpj,
        "phone": telefone,
    }
    data = _post("/customers", payload)
    return data["id"]


# ---------------------------------------------------------------------------
# Subscription (assinatura recorrente)
# ---------------------------------------------------------------------------
def criar_subscription(
    asaas_customer_id: str,
    valor: float,
    proximo_vencimento: str,  # formato YYYY-MM-DD
    descricao: str,
    billing_type: str = "UNDEFINED",  # UNDEFINED = "pergunte ao cliente" (Pix/Boleto/Cartão)
    ciclo: str = "MONTHLY",
) -> dict:
    """Cria a assinatura recorrente no Asaas. Retorna o objeto completo,
    incluindo o 'id' (asaas_subscription_id) a ser salvo no banco.

    Nota: a primeira cobrança NÃO vem no retorno deste POST — é preciso
    consultar GET /subscriptions/{id}/payments depois para pegar o
    asaas_payment_id da primeira fatura."""
    payload = {
        "customer": asaas_customer_id,
        "billingType": billing_type,
        "value": valor,
        "nextDueDate": proximo_vencimento,
        "cycle": ciclo,
        "description": descricao,
    }
    return _post("/subscriptions", payload)


def atualizar_valor_subscription(asaas_subscription_id: str, novo_valor: float) -> dict:
    """Atualiza o valor da assinatura — só afeta cobranças FUTURAS.
    Usado quando o profissional muda de cota (mais clientes extras)."""
    return _put(f"/subscriptions/{asaas_subscription_id}", {"value": novo_valor})


def cancelar_subscription(asaas_subscription_id: str) -> dict:
    """Cancela a assinatura no Asaas — chamar no D+35 (cancelamento
    definitivo por inadimplência) ou se o profissional cancelar voluntariamente."""
    return _delete(f"/subscriptions/{asaas_subscription_id}")


def listar_payments_da_subscription(asaas_subscription_id: str) -> list[dict]:
    """Lista todas as cobranças já geradas para essa assinatura — usar para
    pegar o asaas_payment_id do ciclo mais recente."""
    data = _get(f"/subscriptions/{asaas_subscription_id}/payments")
    return data.get("data", [])


# ---------------------------------------------------------------------------
# Webhook
# ---------------------------------------------------------------------------
def validar_webhook_token(token_recebido: str | None) -> bool:
    """Asaas envia o token configurado no header 'asaas-access-token' de
    cada webhook. Comparação em tempo constante para evitar timing attack."""
    if not token_recebido or not settings.ASAAS_WEBHOOK_TOKEN:
        return False
    return hmac.compare_digest(token_recebido, settings.ASAAS_WEBHOOK_TOKEN)


# Eventos de payment relevantes pro nosso fluxo de cobrança:
#   PAYMENT_CREATED    -> cobrança gerada (informativo, não confirma pagamento)
#   PAYMENT_RECEIVED   -> pago (Pix/dinheiro em conta) — equivalente a "pago"
#   PAYMENT_CONFIRMED  -> pago via cartão/boleto compensado — equivalente a "pago"
#   PAYMENT_OVERDUE    -> venceu sem pagamento -> dispara a régua de inadimplência (D+5/D+35)
#   PAYMENT_DELETED    -> cobrança removida (ex: assinatura cancelada antes do vencimento)
EVENTOS_PAGAMENTO_CONFIRMADO = {"PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"}
EVENTOS_PAGAMENTO_VENCIDO = {"PAYMENT_OVERDUE"}
