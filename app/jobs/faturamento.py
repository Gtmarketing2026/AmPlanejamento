"""
Job de faturamento — pensado para rodar via cron/scheduler (ex: 1x por dia,
verificando quais profissionais têm ciclo vencendo).

Implementa as regras já fechadas:
- Cobrança integral por cliente ativo no fim do ciclo, sem pró-rata
- Idempotência via chave determinística (nunca cobra o mesmo ciclo 2x)
- Snapshot de clientes inclusos/extras naquele ciclo específico

Este arquivo roda FORA do contexto de uma requisição HTTP de profissional,
então NÃO usa get_db_com_rls (que depende de token de usuário autenticado).
Em vez disso, abre a sessão diretamente e seta o contexto de RLS manualmente
para cada profissional processado, um de cada vez.
"""

import hashlib
import uuid
from datetime import date

from sqlalchemy import func, select, text

from app.core.config import settings
from app.db.base import SessionLocal, SessionLocalAdmin
from app.models.cliente import Cliente
from app.models.fatura import Fatura
from app.models.profissional import Profissional


def gerar_idempotency_key(profissional_id: uuid.UUID, ciclo_referencia: date) -> str:
    base = f"{profissional_id}:{ciclo_referencia.isoformat()}"
    return hashlib.sha256(base.encode()).hexdigest()


def processar_ciclo_do_profissional(profissional_id: uuid.UUID, ciclo_referencia: date) -> Fatura | None:
    db = SessionLocal()
    try:
        db.execute(text("SET LOCAL app.current_profissional_id = :pid"), {"pid": str(profissional_id)})

        idempotency_key = gerar_idempotency_key(profissional_id, ciclo_referencia)

        # Se já existe fatura com essa chave, não faz nada — idempotência garantida
        # tanto pela constraint UNIQUE do banco quanto por esta checagem antecipada.
        ja_existe = db.scalar(select(Fatura).where(Fatura.idempotency_key == idempotency_key))
        if ja_existe:
            print(f"[faturamento] Ciclo {ciclo_referencia} do profissional {profissional_id} já cobrado. Pulando.")
            return ja_existe

        qtd_ativos = db.scalar(
            select(func.count()).select_from(Cliente).where(Cliente.status == "ativo")
        )

        # Buscar valores do plano vigente do profissional (simplificado — assume
        # a assinatura mais recente; em produção, buscar a assinatura ativa real)
        from app.models.assinatura import Assinatura

        assinatura = db.scalar(
            select(Assinatura)
            .where(Assinatura.profissional_id == profissional_id)
            .order_by(Assinatura.criado_em.desc())
        )
        if not assinatura:
            print(f"[faturamento] Profissional {profissional_id} sem assinatura ativa. Pulando.")
            return None

        clientes_inclusos = min(qtd_ativos, assinatura.clientes_inclusos)
        clientes_extras = max(0, qtd_ativos - assinatura.clientes_inclusos)
        valor_extras = clientes_extras * float(assinatura.valor_por_extra)
        valor_total = float(assinatura.valor_base) + valor_extras

        # Garante que existe uma subscription no Asaas para este profissional.
        # Criada uma única vez; ciclos seguintes só atualizam o valor se mudou.
        from app.integrations import asaas

        if not assinatura.asaas_subscription_id:
            sub = asaas.criar_subscription(
                asaas_customer_id=assinatura.asaas_customer_id,
                valor=valor_total,
                proximo_vencimento=ciclo_referencia.isoformat(),
                descricao=f"Assinatura Fluxo — {clientes_inclusos + clientes_extras} clientes",
            )
            assinatura.asaas_subscription_id = sub["id"]
            db.add(assinatura)
            db.flush()
        elif abs(valor_total - (float(assinatura.valor_base) + 0)) > 0.01:
            # Valor mudou desde a última fatura (ex: cliente extra novo) —
            # atualiza a subscription. Só afeta cobranças futuras no Asaas.
            asaas.atualizar_valor_subscription(assinatura.asaas_subscription_id, valor_total)

        fatura = Fatura(
            profissional_id=profissional_id,
            ciclo_referencia=ciclo_referencia,
            clientes_inclusos_no_ciclo=clientes_inclusos,
            clientes_extras_no_ciclo=clientes_extras,
            valor_base=assinatura.valor_base,
            valor_extras=valor_extras,
            status="pendente",
            idempotency_key=idempotency_key,
        )
        db.add(fatura)
        db.flush()

        # Busca o payment_id gerado pelo Asaas pra essa subscription no ciclo
        # atual, pra já deixar a fatura local vinculada (o webhook confirma
        # o pagamento depois, casando por esse mesmo asaas_payment_id).
        try:
            payments = asaas.listar_payments_da_subscription(assinatura.asaas_subscription_id)
            if payments:
                fatura.asaas_payment_id = payments[0]["id"]
                fatura.asaas_status = payments[0]["status"]
                db.add(fatura)
        except Exception as e:
            print(f"[faturamento] Aviso: não foi possível buscar payment do Asaas ainda: {e}")

        db.commit()
        db.refresh(fatura)

        print(
            f"[faturamento] Fatura gerada: profissional={profissional_id} "
            f"ciclo={ciclo_referencia} total=R${fatura.valor_total:.2f} "
            f"asaas_payment_id={fatura.asaas_payment_id}"
        )

        return fatura

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def rodar_faturamento_do_dia(ciclo_referencia: date | None = None) -> None:
    """Ponto de entrada do job. Roda para todos os profissionais com
    assinatura ativa cujo vencimento é hoje."""
    ciclo_referencia = ciclo_referencia or date.today().replace(day=1)

    db = SessionLocalAdmin()
    try:
        # Esta query roda sem RLS (é o próprio job de sistema, não um
        # profissional logado) — por isso usa a conexão privilegiada
        # (SessionLocalAdmin), que enxerga todos os tenants.
        profissionais = db.scalars(
            select(Profissional).where(Profissional.status == "ativa")
        ).all()
    finally:
        db.close()

    for profissional in profissionais:
        processar_ciclo_do_profissional(profissional.id, ciclo_referencia)


if __name__ == "__main__":
    rodar_faturamento_do_dia()
