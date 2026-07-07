import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificacaoCriar(BaseModel):
    """Mensagem que o profissional manda direto pro cliente (tipo='outro')."""

    titulo: str
    mensagem: str


class NotificacaoResposta(BaseModel):
    id: uuid.UUID
    tipo: str
    titulo: str
    mensagem: str
    lida_cliente: bool
    criado_em: datetime

    model_config = {"from_attributes": True}
