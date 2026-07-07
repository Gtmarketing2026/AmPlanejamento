import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PreferenciaCliente(Base):
    """Preferências de exibição do cliente final -- hoje só a forma de
    calcular o mês de referência dos lançamentos de cartão (ver
    _calcular_mes_referencia em app/api/routes/importacoes.py). Uma linha
    por cliente."""

    __tablename__ = "preferencias_cliente"

    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), primary_key=True
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    visualizacao_lancamento: Mapped[str] = mapped_column(String, default="data_compra")  # data_compra | virada_cartao
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
