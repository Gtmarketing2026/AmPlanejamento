import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Lançamento <-> Tag é N:N -- um lançamento pode ter várias tags (ex: "viagem",
# "reembolsável") e a mesma tag é reaproveitada em vários lançamentos. Tabelas
# já existiam no schema original (schema_seguranca.sql), nunca implementadas.
transacoes_tags = Table(
    "transacoes_tags",
    Base.metadata,
    Column("transacao_id", UUID(as_uuid=True), ForeignKey("transacoes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Tags são do PLANEJADOR (não do cliente individual) -- reaproveitadas em
    # todos os clientes dele. Cliente final também cria tags: elas entram no
    # mesmo vocabulário do profissional (via cliente.profissional_id).
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    nome: Mapped[str] = mapped_column(String, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
