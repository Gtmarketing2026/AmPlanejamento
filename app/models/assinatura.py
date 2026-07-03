import uuid
from datetime import date

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Assinatura(Base):
    __tablename__ = "assinaturas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    tipo_plano: Mapped[str] = mapped_column(String, default="essencial")  # 'essencial' | 'completo'
    clientes_inclusos: Mapped[int] = mapped_column(default=4)
    valor_base: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    valor_por_extra: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    gateway_customer_token: Mapped[str] = mapped_column(String, nullable=False)
    asaas_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    asaas_subscription_id: Mapped[str | None] = mapped_column(String, nullable=True)
    data_vencimento: Mapped[date] = mapped_column(Date, nullable=False)
    data_inadimplencia: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_congelamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_cancelamento: Mapped[date | None] = mapped_column(Date, nullable=True)
    criado_em: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
