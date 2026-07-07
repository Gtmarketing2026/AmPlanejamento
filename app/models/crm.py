import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InteracaoCrm(Base):
    """Linha do tempo de relacionamento com o cliente (reuniões, mensagens,
    notas, onboarding e alertas automáticos). Ver schema_seguranca.sql."""

    __tablename__ = "interacoes_crm"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # reuniao|mensagem|alerta_automatico|onboarding|nota
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    ator_tipo: Mapped[str] = mapped_column(String, default="profissional")  # profissional|sistema
    data_interacao: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FollowUp(Base):
    """Próximo contato agendado com o cliente. Pode espelhar num evento do
    Google Agenda (sincronização unidirecional: o banco é a fonte da verdade)."""

    __tablename__ = "follow_ups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    data_prevista: Mapped[date] = mapped_column(Date, nullable=False)
    observacao: Mapped[str | None] = mapped_column(Text, nullable=True)
    concluido: Mapped[bool] = mapped_column(Boolean, default=False)
    concluido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    google_event_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sincronizado_google: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TarefaCliente(Base):
    """Checklist de tarefas que o profissional passa pro cliente executar
    (ex: investir em tal ativo, reduzir gasto numa categoria, contestar uma
    cobrança). O profissional cria/edita; o cliente só marca como concluída."""

    __tablename__ = "tarefas_cliente"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    prazo: Mapped[date | None] = mapped_column(Date, nullable=True)
    concluido: Mapped[bool] = mapped_column(Boolean, default=False)
    concluido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CredencialGoogle(Base):
    """Credenciais OAuth do Google de um profissional (uma conta Google por
    profissional). Guardamos o refresh_token para reobter access_tokens sem
    pedir consentimento de novo. Uma linha por profissional."""

    __tablename__ = "credenciais_google"

    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), primary_key=True
    )
    email_google: Mapped[str | None] = mapped_column(String, nullable=True)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    calendar_id: Mapped[str] = mapped_column(String, default="primary")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
