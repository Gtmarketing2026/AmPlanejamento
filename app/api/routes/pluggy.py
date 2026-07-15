"""
Rotas do Open Finance via Pluggy (cliente final).

Etapa 1 (esta): status + connect-token -- o suficiente pro frontend abrir o
widget Pluggy Connect e o cliente autorizar o banco. A sincronização das
transações (item -> Transacao) entra na etapa 2, junto com o widget.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.api.deps import get_cliente_id_atual, get_db_admin
from app.api.routes.importacoes import (
    _transacao_valida,
    aplicar_classificacao_creditos,
    aplicar_classificacao_por_historico,
    aplicar_classificacao_por_regras,
    aplicar_classificacao_renda,
)
from app.integrations import pluggy
from app.models.cliente import Cliente
from app.models.conta_conectada import ContaConectada
from app.models.transacao import Transacao
from app.parsers.dedup import calcular_hash_dedup
from app.schemas.pluggy import ConnectTokenResposta, PluggyStatusResposta, SyncPedido, SyncResposta

router = APIRouter(prefix="/clientes/eu/pluggy", tags=["pluggy"])


@router.get("/status", response_model=PluggyStatusResposta)
def status_pluggy(_: uuid.UUID = Depends(get_cliente_id_atual)):
    """O frontend usa isso pra decidir se mostra o botão 'Conectar banco'."""
    return PluggyStatusResposta(ativo=pluggy.pluggy_ativo())


@router.post("/connect-token", response_model=ConnectTokenResposta)
def connect_token(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    """Gera o token de curta duração que o widget Pluggy Connect precisa."""
    if not pluggy.pluggy_ativo():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Open Finance não está configurado.")
    try:
        token = pluggy.criar_connect_token(str(cliente_id))
    except pluggy.PluggyIndisponivel as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e
    return ConnectTokenResposta(access_token=token)


@router.post("/sync", response_model=SyncResposta)
def sincronizar(
    pedido: SyncPedido,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    """Puxa contas + transações de um item recém-conectado no widget e insere no
    fluxo do cliente (dedup por hash + classificação instantânea por histórico/
    regras, igual à importação por arquivo). A IA roda depois, sob demanda."""
    if not pluggy.pluggy_ativo():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Open Finance não está configurado.")
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    prof_id = cliente.profissional_id
    try:
        item = pluggy.obter_item(pedido.item_id)
        contas_pluggy = pluggy.listar_contas(pedido.item_id)
    except pluggy.PluggyIndisponivel as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e

    banco = (item.get("connector") or {}).get("name") or "Banco conectado"
    importadas = duplicadas = 0
    inseridas_ids: list = []

    for acc in contas_pluggy:
        acc_id = str(acc.get("id"))
        natureza = "cartao" if str(acc.get("type") or "").upper() == "CREDIT" else "conta"
        conta = db.scalar(
            select(ContaConectada).where(
                ContaConectada.cliente_id == cliente_id, ContaConectada.item_id_provedor == acc_id
            )
        )
        if conta is None:
            conta = ContaConectada(
                cliente_id=cliente_id, profissional_id=prof_id, modo="open_finance",
                provedor="pluggy", item_id_provedor=acc_id, banco=banco, natureza=natureza,
                nome_exibicao=acc.get("name") or banco, contexto="ambos",
            )
            db.add(conta)
            db.flush()
        conta.ultima_sincronizacao = datetime.now(timezone.utc)
        conta.status = "ativa"

        origem = "cartao" if natureza == "cartao" else "conta"
        try:
            txs = pluggy.listar_transacoes(acc_id, desde=date.today() - timedelta(days=365))
        except pluggy.PluggyIndisponivel:
            txs = []
        for tx in txs:
            m = pluggy.mapear_transacao(tx)
            if not m or not _transacao_valida(m):
                continue
            hd = calcular_hash_dedup(conta.id, m["data"], m["valor"], m["descricao"])
            stmt = (
                pg_insert(Transacao)
                .values(
                    conta_conectada_id=conta.id, cliente_id=cliente_id, profissional_id=prof_id,
                    data=m["data"], descricao=m["descricao"], valor=m["valor"], tipo=m["tipo"],
                    origem=origem, contexto="PF", hash_dedup=hd,
                    mes_referencia=date(m["data"].year, m["data"].month, 1),
                )
                .on_conflict_do_nothing(index_elements=["conta_conectada_id", "hash_dedup"])
                .returning(Transacao.id)
            )
            row = db.execute(stmt).first()
            if row:
                importadas += 1
                inseridas_ids.append(row[0])
            else:
                duplicadas += 1

    if inseridas_ids:
        novas = db.scalars(select(Transacao).where(Transacao.id.in_(inseridas_ids))).all()
        aplicar_classificacao_creditos(db, novas)
        aplicar_classificacao_renda(db, novas)
        aplicar_classificacao_por_historico(db, cliente_id, novas)
        aplicar_classificacao_por_regras(db, novas)

    return SyncResposta(banco=banco, contas=len(contas_pluggy), importadas=importadas, duplicadas=duplicadas)
