import uuid
from datetime import date

from sqlalchemy import String, Date, Boolean, DateTime, ForeignKey, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    nome: Mapped[str] = mapped_column(String, nullable=False)
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # 'PF' | 'PJ' (tipo principal)
    documento: Mapped[str] = mapped_column(String, nullable=False)  # CPF, sempre obrigatório
    # Contexto PJ opcional: cliente PF que também tem uma empresa (ex: Marina
    # Castro pessoa física + Castro Design ME) — presença de cnpj habilita a
    # aba Pessoal/PJ no dashboard, sem precisar de um segundo cadastro.
    cnpj: Mapped[str | None] = mapped_column(String, nullable=True)
    nome_pj: Mapped[str | None] = mapped_column(String, nullable=True)
    # Acesso do cliente final ao próprio dashboard (login separado do
    # profissional). nickname único globalmente pra servir de identificador
    # de login simples.
    nickname: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    senha_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    data_cadastro: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    status: Mapped[str] = mapped_column(String, default="ativo")  # ativo | excluido
    data_exclusao: Mapped[date | None] = mapped_column(Date, nullable=True)
    motivo_churn: Mapped[str | None] = mapped_column(String, nullable=True)
    motivo_churn_detalhe: Mapped[str | None] = mapped_column(String, nullable=True)
    conexao_pausada: Mapped[bool] = mapped_column(Boolean, default=False)
    perfil_comportamental: Mapped[str | None] = mapped_column(String, nullable=True)
    objetivo_principal: Mapped[str | None] = mapped_column(String, nullable=True)  # "onde quero chegar"
    historico: Mapped[str | None] = mapped_column(String, nullable=True)  # contexto/histórico do cliente (texto livre)
    situacao_atual: Mapped[str | None] = mapped_column(String, nullable=True)  # "onde estou" (ponto de partida do mapa)
    valor_honorario_mensal: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    criado_em: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def data_limite_exclusao(self) -> date:
        """Espelha a coluna gerada do banco (data_cadastro + 35 dias) para uso em Python
        sem precisar de round-trip ao banco. A fonte da verdade continua sendo a coluna
        GENERATED do schema; isto é só uma conveniência de leitura."""
        from datetime import timedelta

        from app.core.config import settings

        return self.data_cadastro + timedelta(days=settings.PRAZO_EXCLUSAO_SEM_COBRANCA_DIAS)
