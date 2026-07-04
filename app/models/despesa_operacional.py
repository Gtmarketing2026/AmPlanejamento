import uuid
from datetime import date

from sqlalchemy import Date, DateTime, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DespesaOperacional(Base):
    """Custo do NEGÓCIO Fluxo em si (hospedagem, Asaas, Open Finance...), não
    das carteiras dos clientes. Só o nível Negócio (get_db_negocio) acessa —
    tabela sem RLS por profissional_id (ver schema_seguranca.sql)."""

    __tablename__ = "despesas_operacionais"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    descricao: Mapped[str] = mapped_column(String, nullable=False)
    categoria: Mapped[str] = mapped_column(String, nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    criado_em: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
