import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Transacao(Base):
    __tablename__ = "transacoes"

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
    data: Mapped[date] = mapped_column(Date, nullable=False)
    descricao: Mapped[str] = mapped_column(String, nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # entrada | saida
    origem: Mapped[str] = mapped_column(String, nullable=False)  # conta | cartao
    # categoria_id/subcategoria_id/instituicao_id apontam pra tabelas que
    # ainda não têm model Python (só existem no schema SQL, sem CRUD de API
    # ainda -- ver CLAUDE.md). A FK real já existe no banco (schema_seguranca.sql);
    # aqui fica só como UUID simples pra não quebrar o SQLAlchemy tentando
    # resolver dependência com uma tabela sem mapper registrado.
    categoria_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    subcategoria_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    instituicao_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    cartao_nome: Mapped[str | None] = mapped_column(String, nullable=True)
    cartao_ultimos_digitos: Mapped[str | None] = mapped_column(String, nullable=True)
    parcela_atual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parcela_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conciliado: Mapped[bool] = mapped_column(Boolean, default=False)
    importacao_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("importacoes_extrato.id", ondelete="SET NULL"), nullable=True
    )
    hash_dedup: Mapped[str] = mapped_column(String, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
