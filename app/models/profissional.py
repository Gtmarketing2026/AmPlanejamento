import uuid
from datetime import date

from sqlalchemy import Boolean, Date, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Profissional(Base):
    __tablename__ = "profissionais"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    senha_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trial_ate: Mapped[date | None] = mapped_column(Date, nullable=True)
    subdominio: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    cor_marca: Mapped[str] = mapped_column(String, default="#4C8DFF")
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ativa")  # ativa | congelada | cancelada
    criado_em: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
