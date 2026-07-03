import uuid
from datetime import date

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Fatura(Base):
    __tablename__ = "faturas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    ciclo_referencia: Mapped[date] = mapped_column(Date, nullable=False)
    clientes_inclusos_no_ciclo: Mapped[int] = mapped_column(nullable=False)
    clientes_extras_no_ciclo: Mapped[int] = mapped_column(default=0)
    valor_base: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    valor_extras: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[str] = mapped_column(String, default="pendente")
    idempotency_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    gateway_charge_id: Mapped[str | None] = mapped_column(String, nullable=True)
    asaas_payment_id: Mapped[str | None] = mapped_column(String, nullable=True)
    asaas_status: Mapped[str | None] = mapped_column(String, nullable=True)
    criado_em: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def valor_total(self) -> float:
        return float(self.valor_base) + float(self.valor_extras)
