"""
Notificações -- avisos que o cliente final recebe, tanto automáticos do
sistema (ex: fatura perto do vencimento) quanto mensagens diretas do
profissional. Tabela e RLS já existiam (schema_seguranca.sql); aqui entra
model+rotas. O cliente só lê e marca como lida; quem cria é o sistema (ver
`notificar_cliente` usado em app/api/routes/crm.py ao criar uma tarefa) ou o
profissional via `router` (prefixo /crm) abaixo.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_cliente_id_atual, get_db_admin, get_db_com_rls, get_profissional_id_atual
from app.models.cliente import Cliente
from app.models.notificacao import Notificacao
from app.schemas.notificacao import NotificacaoCriar, NotificacaoResposta

router = APIRouter(prefix="/crm", tags=["notificacoes"])
router_cliente = APIRouter(prefix="/clientes/eu", tags=["notificacoes"])


def notificar_cliente(db: Session, cliente_id: uuid.UUID, profissional_id: uuid.UUID, tipo: str, titulo: str, mensagem: str) -> None:
    """Helper reaproveitável por qualquer rota que precise avisar o cliente
    (ex: ao criar uma tarefa no CRM). Não faz commit -- fica na mesma
    transação do caller."""
    db.add(
        Notificacao(
            cliente_id=cliente_id,
            profissional_id=profissional_id,
            destinatario="cliente_final",
            tipo=tipo,
            titulo=titulo,
            mensagem=mensagem,
        )
    )


@router.post(
    "/clientes/{cliente_id}/notificacoes",
    response_model=NotificacaoResposta,
    status_code=status.HTTP_201_CREATED,
)
def enviar_notificacao_cliente(
    cliente_id: uuid.UUID,
    dados: NotificacaoCriar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
):
    cliente = db.get(Cliente, cliente_id)
    if cliente is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    notificacao = Notificacao(
        cliente_id=cliente_id,
        profissional_id=profissional_id,
        destinatario="cliente_final",
        tipo="outro",
        titulo=dados.titulo,
        mensagem=dados.mensagem,
    )
    db.add(notificacao)
    db.flush()
    db.refresh(notificacao)
    return notificacao


@router_cliente.get("/notificacoes", response_model=list[NotificacaoResposta])
def listar_minhas_notificacoes(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    return db.scalars(
        select(Notificacao)
        .where(Notificacao.cliente_id == cliente_id, Notificacao.destinatario.in_(["cliente_final", "ambos"]))
        .order_by(Notificacao.criado_em.desc())
    ).all()


@router_cliente.patch("/notificacoes/{notificacao_id}", response_model=NotificacaoResposta)
def marcar_notificacao_lida(
    notificacao_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    notificacao = db.get(Notificacao, notificacao_id)
    if notificacao is None or notificacao.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notificação não encontrada")
    notificacao.lida_cliente = True
    return notificacao


@router_cliente.post("/notificacoes/marcar-todas-lidas", status_code=status.HTTP_204_NO_CONTENT)
def marcar_todas_lidas(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    db.execute(
        update(Notificacao).where(Notificacao.cliente_id == cliente_id).values(lida_cliente=True)
    )
