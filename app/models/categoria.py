import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profissional_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=True
    )  # NULL = padrão do sistema, visível a todos
    # Categoria própria de UM cliente (não compartilhada com os outros clientes
    # do mesmo profissional) -- quando setado, profissional_id também vem
    # preenchido (o profissional_id do cliente dono), só pra manter a RLS do
    # profissional funcionando igual (ver isolar_categorias em
    # schema_seguranca.sql); a distinção "compartilhada vs só do cliente" é
    # sempre feita por cliente_id IS NULL vs NOT NULL.
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=True
    )
    nome: Mapped[str] = mapped_column(String, nullable=False)
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # entrada | saida | neutra | investimento
    icone: Mapped[str | None] = mapped_column(String, nullable=True)  # emoji exibido no lançamento
    contexto: Mapped[str] = mapped_column(String, nullable=False, default="ambos")  # PF | PJ | ambos
    padrao_sistema: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subcategoria(Base):
    __tablename__ = "subcategorias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    categoria_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categorias.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=True
    )
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=True
    )
    nome: Mapped[str] = mapped_column(String, nullable=False)
    padrao_sistema: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
