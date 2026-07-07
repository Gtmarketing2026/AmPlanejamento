import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ContaConectada(Base):
    __tablename__ = "contas_conectadas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    modo: Mapped[str] = mapped_column(String, default="manual")  # 'open_finance' | 'manual'
    provedor: Mapped[str | None] = mapped_column(String, nullable=True)
    item_id_provedor: Mapped[str | None] = mapped_column(String, nullable=True)
    banco: Mapped[str | None] = mapped_column(String, nullable=True)
    tipo_conta: Mapped[str | None] = mapped_column(String, nullable=True)
    token_consentimento_enc: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ativa")  # ativa | pausada | revogada | erro
    consentimento_expira_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ultima_sincronizacao: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # "Minhas Contas": mesma tabela representa conta bancária E cartão de
    # crédito (natureza), evitando uma segunda tabela quase idêntica -- os
    # campos abaixo só fazem sentido conforme a natureza.
    natureza: Mapped[str] = mapped_column(String, default="conta")  # conta | cartao
    nome_exibicao: Mapped[str | None] = mapped_column(String, nullable=True)
    saldo_manual: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)  # natureza=conta
    limite_total: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)  # natureza=cartao
    dia_virada: Mapped[int | None] = mapped_column(Integer, nullable=True)  # natureza=cartao, 1-31, opcional
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
