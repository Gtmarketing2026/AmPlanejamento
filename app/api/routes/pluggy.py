"""
Rotas do Open Finance via Pluggy (cliente final).

Etapa 1 (esta): status + connect-token -- o suficiente pro frontend abrir o
widget Pluggy Connect e o cliente autorizar o banco. A sincronização das
transações (item -> Transacao) entra na etapa 2, junto com o widget.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_cliente_id_atual, get_db_admin
from app.integrations import pluggy
from app.schemas.pluggy import ConnectTokenResposta, PluggyStatusResposta

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
