"""
Assinatura do planejador — escolha de plano + checkout Asaas (sandbox).

Fluxo: o planejador se cadastra (vira lead, sem plano), depois escolhe um
plano aqui -> criamos o customer + subscription no Asaas, registramos a
Assinatura e a primeira Fatura (pendente), e devolvemos o link de pagamento.
Quando o pagamento é confirmado (webhook PAYMENT_CONFIRMED/RECEIVED marca a
fatura como 'paga'), o app destrava (ver core/planos.py::tem_plano_ativo).
"""

import hashlib
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db_com_rls, get_profissional_id_atual
from app.core.planos import PLANOS, tem_plano_ativo
from app.integrations import asaas
from app.models.assinatura import Assinatura
from app.models.fatura import Fatura
from app.models.profissional import Profissional
from app.schemas.assinatura import AssinaturaResposta, EscolherPlanoRequest

router = APIRouter(prefix="/assinatura", tags=["assinatura"])


def _invoice_url_pendente(assinatura: Assinatura | None, db: Session, profissional_id: uuid.UUID):
    """Devolve (invoice_url, status_pagamento) da fatura mais recente da
    assinatura — busca o link ao vivo no Asaas enquanto está pendente."""
    if not assinatura:
        return None, None
    fatura = db.scalar(
        select(Fatura)
        .where(Fatura.profissional_id == profissional_id)
        .order_by(Fatura.criado_em.desc())
        .limit(1)
    )
    if not fatura:
        return None, None
    invoice_url = None
    if fatura.status != "paga" and fatura.asaas_payment_id:
        try:
            invoice_url = asaas.get_payment(fatura.asaas_payment_id).get("invoiceUrl")
        except Exception:
            invoice_url = None
    return invoice_url, fatura.status


def _montar_resposta(db: Session, profissional: Profissional) -> AssinaturaResposta:
    assinatura = db.scalar(
        select(Assinatura)
        .where(Assinatura.profissional_id == profissional.id)
        .order_by(Assinatura.criado_em.desc())
        .limit(1)
    )
    invoice_url, status_pag = _invoice_url_pendente(assinatura, db, profissional.id)
    plano = PLANOS.get(assinatura.tipo_plano) if assinatura else None
    return AssinaturaResposta(
        tem_assinatura=assinatura is not None,
        plano_ativo=tem_plano_ativo(db, profissional),
        tipo_plano=assinatura.tipo_plano if assinatura else None,
        nome_plano=plano["nome"] if plano else None,
        valor_base=float(assinatura.valor_base) if assinatura else None,
        invoice_url=invoice_url,
        status_pagamento=status_pag,
    )


@router.get("/planos")
def catalogo_planos():
    """Catálogo de planos (valores) — pra tela de escolha renderizar os cards
    sem hardcodar preço no frontend."""
    return [
        {
            "tipo_plano": p["tipo_plano"],
            "nome": p["nome"],
            "valor_base": p["valor_base"],
            "valor_por_extra": p["valor_por_extra"],
            "clientes_inclusos": p["clientes_inclusos"],
        }
        for p in PLANOS.values()
    ]


@router.get("/eu", response_model=AssinaturaResposta)
def minha_assinatura(
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    profissional = db.get(Profissional, profissional_id)
    return _montar_resposta(db, profissional)


@router.post("/escolher-plano", response_model=AssinaturaResposta)
def escolher_plano(
    dados: EscolherPlanoRequest,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    plano = PLANOS.get(dados.tipo_plano)
    if not plano:
        raise HTTPException(status_code=422, detail="Plano inválido (essencial | completo)")

    profissional = db.get(Profissional, profissional_id)

    # Já tem assinatura? Não recria no Asaas -- só devolve o estado atual
    # (o frontend usa o invoice_url pra levar de novo pro pagamento).
    ja_tem = db.scalar(select(Assinatura).where(Assinatura.profissional_id == profissional_id))
    if ja_tem:
        return _montar_resposta(db, profissional)

    # --- Asaas: customer + subscription + primeira cobrança ---
    try:
        customer_id = asaas.criar_customer(profissional.nome, profissional.email, dados.cpf_cnpj)
        subscription = asaas.criar_subscription(
            asaas_customer_id=customer_id,
            valor=plano["valor_base"],
            proximo_vencimento=date.today().isoformat(),
            descricao=f"Fluxo — {plano['nome']}",
        )
        subscription_id = subscription["id"]
        payments = asaas.listar_payments_da_subscription(subscription_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao criar cobrança no Asaas: {e}")

    primeira = payments[0] if payments else {}
    asaas_payment_id = primeira.get("id")
    invoice_url = primeira.get("invoiceUrl")

    # --- Persistência: Assinatura + primeira Fatura ---
    assinatura = Assinatura(
        profissional_id=profissional_id,
        tipo_plano=plano["tipo_plano"],
        clientes_inclusos=plano["clientes_inclusos"],
        valor_base=plano["valor_base"],
        valor_por_extra=plano["valor_por_extra"],
        gateway_customer_token=customer_id,  # compat legado; asaas_customer_id abaixo é o campo canônico
        asaas_customer_id=customer_id,
        asaas_subscription_id=subscription_id,
        data_vencimento=date.today(),
    )
    db.add(assinatura)

    idem = hashlib.sha256(f"assinatura-inicial:{profissional_id}".encode()).hexdigest()
    fatura = Fatura(
        profissional_id=profissional_id,
        ciclo_referencia=date.today().replace(day=1),
        clientes_inclusos_no_ciclo=plano["clientes_inclusos"],
        clientes_extras_no_ciclo=0,
        valor_base=plano["valor_base"],
        valor_extras=0,
        status="pendente",
        idempotency_key=idem,
        asaas_payment_id=asaas_payment_id,
    )
    db.add(fatura)
    db.flush()

    return AssinaturaResposta(
        tem_assinatura=True,
        plano_ativo=tem_plano_ativo(db, profissional),
        tipo_plano=plano["tipo_plano"],
        nome_plano=plano["nome"],
        valor_base=plano["valor_base"],
        invoice_url=invoice_url,
        status_pagamento="pendente",
    )
