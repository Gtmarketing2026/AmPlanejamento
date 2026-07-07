import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

TIPOS_NOTIFICACAO = {
    "gasto_acima_categoria",
    "meta_atingida",
    "meta_em_risco",
    "fatura_proxima_vencimento",
    "divida_proxima_vencimento",
    "conexao_desatualizada",
    "consentimento_expirando",
    "outro",
}


class Notificacao(Base):
    """Avisos pro profissional e/ou cliente final -- tanto automáticos (ex:
    gasto acima da categoria) quanto mensagens diretas do profissional pro
    cliente. Tabela já existia no schema (schema_seguranca.sql) sem model."""

    __tablename__ = "notificacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    destinatario: Mapped[str] = mapped_column(String, nullable=False)  # profissional | cliente_final | ambos
    tipo: Mapped[str] = mapped_column(String, nullable=False)
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    lida_profissional: Mapped[bool] = mapped_column(Boolean, default=False)
    lida_cliente: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
