import uuid
from datetime import date

from sqlalchemy import Boolean, Date, Numeric, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Profissional(Base):
    __tablename__ = "profissionais"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    nome_empresa: Mapped[str | None] = mapped_column(String, nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    senha_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trial_ate: Mapped[date | None] = mapped_column(Date, nullable=True)
    subdominio: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    # Cor de marca (white-label). Padrão = accent verde do app, pra quem não
    # personaliza não ver mudança nenhuma; ao escolher outra cor, o app do
    # planejador (e a área do cliente dele) passam a usá-la como accent.
    cor_marca: Mapped[str] = mapped_column(String, default="#26D9A8")
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    video_boas_vindas: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ativa")  # ativa | congelada | cancelada
    # Última vez que o planejador abriu o painel de Novidades (changelog).
    novidades_vistas_em: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Consentimento LGPD no cadastro: quando aceitou e qual versão dos termos.
    termos_aceitos_em: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    termos_versao: Mapped[str | None] = mapped_column(String, nullable=True)
    criado_em: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Critérios da saúde financeira do cliente (o planejador pode ajustar na aba
    # Configurações). Defaults = as regras que estavam hardcoded antes.
    # Vermelho: gasta mais do que ganha OU reserva < reserva_min_meses.
    # Azul (excelente): poupança >= azul_poupanca E reserva >= azul_reserva.
    # Verde (saudável): poupança >= verde_poupanca E reserva >= verde_reserva.
    # Senão: amarelo.
    saude_reserva_min_meses: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=3)
    saude_verde_reserva_meses: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=6)
    saude_verde_poupanca_pct: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=15)
    saude_azul_reserva_meses: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=12)
    saude_azul_poupanca_pct: Mapped[float] = mapped_column(Numeric(5, 1), nullable=False, default=30)

    # Vagas de clientes concedidas pelo admin (por planejador):
    # vagas_inclusas = quantas entram sem cobrança (padrão 4);
    # valor_vaga_extra = R$/mês por cliente acima das inclusas (None = padrão do
    # plano; 0 = extras grátis; >0 = preço custom). Ver migration_vagas_planejador.sql.
    vagas_inclusas: Mapped[int] = mapped_column(nullable=False, default=4)
    valor_vaga_extra: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
