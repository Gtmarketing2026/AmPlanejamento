import uuid
from datetime import date, datetime

from sqlalchemy import Computed, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Meta(Base):
    """Objetivo financeiro do cliente (sair do aluguel, aposentadoria, viagem
    etc). valor_atual é somado automaticamente pelo trigger trg_atualizar_meta
    a cada MetaAporte inserido (ver schema_seguranca.sql)."""

    __tablename__ = "metas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    titulo: Mapped[str] = mapped_column(String, nullable=False)
    tipo: Mapped[str] = mapped_column(String, default="outro")
    valor_alvo: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_atual: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    # progresso_pct é GENERATED ALWAYS no banco -- Computed() avisa o SQLAlchemy
    # pra nunca incluir essa coluna em INSERT/UPDATE (senão o Postgres rejeita
    # com "cannot insert into generated column").
    progresso_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), Computed("0"), nullable=True)
    prazo: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="em_andamento")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MetaAporte(Base):
    __tablename__ = "metas_aportes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("metas.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    valor: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    data: Mapped[date] = mapped_column(Date, default=date.today)
    origem: Mapped[str] = mapped_column(String, default="manual")
    transacao_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transacoes.id", ondelete="SET NULL"), nullable=True
    )
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Divida(Base):
    __tablename__ = "dividas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(String, nullable=False)
    credor: Mapped[str] = mapped_column(String, nullable=False)
    valor_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    valor_pago: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    # valor_restante é GENERATED ALWAYS no banco -- ver nota em Meta.progresso_pct.
    valor_restante: Mapped[float | None] = mapped_column(Numeric(12, 2), Computed("0"), nullable=True)
    taxa_juros_mensal_pct: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    parcelas_totais: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parcelas_pagas: Mapped[int] = mapped_column(Integer, default=0)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_prevista_quitacao: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ativa")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Investimento(Base):
    __tablename__ = "investimentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    conta_conectada_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contas_conectadas.id", ondelete="SET NULL"), nullable=True
    )
    tipo: Mapped[str] = mapped_column(String, nullable=False)
    nome_ativo: Mapped[str] = mapped_column(String, nullable=False)
    # Sem ForeignKey() do lado do SQLAlchemy porque instituicoes_bancarias não
    # tem model Python (mesmo motivo documentado em Transacao.instituicao_id)
    # -- a FK real já existe no banco (schema_seguranca.sql).
    instituicao_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    quantidade: Mapped[float | None] = mapped_column(Numeric(18, 8), nullable=True)
    valor_aplicado: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    valor_atual: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    data_referencia: Mapped[date] = mapped_column(Date, default=date.today)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Simulacao(Base):
    """Cenário de projeção de patrimônio ("Meu Futuro" / independência
    financeira). O valor_final_projetado fica cacheado, recalculado sempre
    que os parâmetros mudam (ver fórmula em schema_seguranca.sql)."""

    __tablename__ = "simulacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    nome_cenario: Mapped[str] = mapped_column(String, default="Cenário base")
    patrimonio_inicial: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    aporte_mensal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    taxa_retorno_anual_pct: Mapped[float] = mapped_column(Numeric(6, 3), nullable=False)
    prazo_anos: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_final_projetado: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    criado_por: Mapped[str] = mapped_column(String, default="cliente_final")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OrcamentoCategoria(Base):
    """Limite de gasto mensal por categoria (tela Orçamento — orçado x
    realizado). Um registro por cliente/categoria/mês/ano."""

    __tablename__ = "orcamentos_categoria"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    categoria_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categorias.id", ondelete="CASCADE"), nullable=False
    )
    ano: Mapped[int] = mapped_column(Integer, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_orcado: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BemPatrimonial(Base):
    """Bem móvel (carro) ou imóvel (casa) cadastrado manualmente pelo
    cliente, somado ao Patrimônio junto com saldo/investimentos/dívidas."""

    __tablename__ = "bens_patrimoniais"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # movel | imovel
    nome: Mapped[str] = mapped_column(String, nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
