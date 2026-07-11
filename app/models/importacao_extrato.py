import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ImportacaoExtrato(Base):
    __tablename__ = "importacoes_extrato"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conta_conectada_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contas_conectadas.id", ondelete="CASCADE"), nullable=False
    )
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    tipo_documento: Mapped[str] = mapped_column(String, nullable=False)  # extrato | fatura_cartao
    formato_arquivo: Mapped[str] = mapped_column(String, nullable=False)  # ofx | csv | pdf
    arquivo_url: Mapped[str] = mapped_column(String, nullable=False)  # caminho no Supabase Storage
    arquivo_hash: Mapped[str | None] = mapped_column(String, nullable=True)  # sha256 do conteúdo (dedup por arquivo)
    periodo_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    periodo_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pendente")  # pendente|processando|processado|erro
    transacoes_importadas: Mapped[int] = mapped_column(Integer, default=0)
    transacoes_duplicadas: Mapped[int] = mapped_column(Integer, default=0)
    erro_detalhe: Mapped[str | None] = mapped_column(String, nullable=True)
    enviado_por: Mapped[str] = mapped_column(String, default="profissional")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
