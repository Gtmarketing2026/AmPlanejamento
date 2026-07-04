import uuid

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Admin(Base):
    """Nível de acesso "Negócio" — separado de Profissional (ver
    schema_seguranca.sql e CLAUDE.md, seção "Três níveis de acesso").
    Nunca confundir com Profissional.is_admin (mecanismo à parte, de suporte
    interno)."""

    __tablename__ = "admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    senha_hash: Mapped[str] = mapped_column(String, nullable=False)
    criado_em: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
