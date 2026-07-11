import uuid
from datetime import date, datetime

from sqlalchemy import Computed, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
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
    # essencial = curto prazo · desejo = médio prazo · sonho = longo prazo
    prioridade: Mapped[str] = mapped_column(String, default="desejo")
    valor_alvo: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    data_inicial: Mapped[date | None] = mapped_column(Date, nullable=True)  # início do projeto
    valor_atual: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    # progresso_pct é GENERATED ALWAYS no banco -- Computed() avisa o SQLAlchemy
    # pra nunca incluir essa coluna em INSERT/UPDATE (senão o Postgres rejeita
    # com "cannot insert into generated column").
    progresso_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), Computed("0"), nullable=True)
    prazo: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="em_andamento")
    # Quanto o cliente pretende investir por mês voltado a este objetivo
    # (usado no resumo de Investimentos -- soma de todas as metas ativas).
    aporte_mensal_meta: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
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
    responsavel: Mapped[str] = mapped_column(String, default="titular")  # titular | conjuge | ambos
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
    # Classe do ativo (ex: Ações, CDB, ETF, Título público) -- opcional, mais
    # granular que `tipo`; aparece como coluna na carteira.
    classe_ativo: Mapped[str | None] = mapped_column(String, nullable=True)
    nome_ativo: Mapped[str] = mapped_column(String, nullable=False)
    # Sem ForeignKey() do lado do SQLAlchemy porque instituicoes_bancarias não
    # tem model Python (mesmo motivo documentado em Transacao.instituicao_id)
    # -- a FK real já existe no banco (schema_seguranca.sql).
    instituicao_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Nome livre da instituição (ex: "Nubank", "XP") -- mais simples que exigir
    # cadastro prévio numa tabela de instituições pra um MVP de carteira.
    instituicao_nome: Mapped[str | None] = mapped_column(String, nullable=True)
    liquidez: Mapped[str | None] = mapped_column(String, nullable=True)  # ex: "Diária", "D+30", "Sem vencimento"
    # Resgate por data: quando o resgate é "na data de vencimento" em vez de por
    # liquidez (ex: CDB/Tesouro com vencimento). Um ou outro -- não os dois.
    data_vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
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
    # taxa de acumulação (fase antes da aposentadoria)
    taxa_retorno_anual_pct: Mapped[float] = mapped_column(Numeric(6, 3), nullable=False)
    prazo_anos: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_final_projetado: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    criado_por: Mapped[str] = mapped_column(String, default="cliente_final")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Independência financeira: campos usados pra calcular o aporte necessário
    # (todos opcionais -- cenários antigos/simples continuam funcionando sem
    # eles, só não mostram o quadro "quanto preciso investir por mês").
    idade_atual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    idade_aposentadoria: Mapped[int | None] = mapped_column(Integer, nullable=True)
    renda_desejada_mensal: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    outras_rendas_mensal: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0)
    # taxa de retorno na fase de usufruto (pós-aposentadoria) -- normalmente
    # menor/mais conservadora que a taxa de acumulação.
    taxa_pos_aposentadoria_pct: Mapped[float | None] = mapped_column(Numeric(6, 3), nullable=True)
    aporte_necessario: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    patrimonio_necessario: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)


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
    # Opcional: meta mais específica, restrita a uma subcategoria (ex: "Uber"
    # dentro de "Transporte") em vez da categoria inteira.
    subcategoria_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subcategorias.id", ondelete="CASCADE"), nullable=True
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
    # Subtipo do imóvel (Residencial/Veraneio/Comercial/Investimento/Participação
    # empresa) -- opcional, só faz sentido quando tipo == 'imovel'.
    subtipo: Mapped[str | None] = mapped_column(String, nullable=True)
    nome: Mapped[str] = mapped_column(String, nullable=False)
    valor: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # valor de mercado do bem
    proprietario: Mapped[str] = mapped_column(String, default="titular")  # titular | conjuge | ambos
    # Quanto ainda se deve do bem (ex: financiamento em aberto). Entra como
    # passivo no patrimônio líquido -- o bem soma o valor de mercado e abate
    # o saldo devedor.
    saldo_devedor: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    # Valor da prestação mensal do financiamento (quando há saldo devedor). Com
    # ele o app estima quantas parcelas ainda faltam (saldo / prestação).
    valor_prestacao: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvestimentoAlocacao(Base):
    """Quanto de um investimento está reservado pra cada objetivo (meta).
    Um investimento pode ser dividido entre vários objetivos -- ex: metade
    de um CDB pra reserva de emergência, metade pra independência financeira."""

    __tablename__ = "investimento_alocacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investimento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("investimentos.id", ondelete="CASCADE"), nullable=False
    )
    meta_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("metas.id", ondelete="CASCADE"), nullable=False
    )
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    valor_alocado: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ApoliceSeguro(Base):
    """Apólice de seguro cadastrada manualmente (Minha Proteção)."""

    __tablename__ = "apolices_seguro"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    titular: Mapped[str | None] = mapped_column(String, nullable=True)  # quem é o segurado (titular/cônjuge/dependente)
    tipo: Mapped[str] = mapped_column(String, nullable=False)  # vida | saude | patrimonial | outro
    seguradora: Mapped[str] = mapped_column(String, nullable=False)  # instituição
    valor_cobertura: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # cobertura total
    premio_mensal: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)  # prêmio
    vigencia_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)  # vigência final
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Milha(Base):
    """Milhas aéreas do cliente (parte do Patrimônio). Cadastro simples por
    programa de milhagem, com proprietário (titular | cônjuge) e vencimento."""

    __tablename__ = "milhas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    categoria: Mapped[str | None] = mapped_column(String, nullable=True)  # ex: Aérea, Banco, Cartão
    programa: Mapped[str] = mapped_column(String, nullable=False)  # ex: Smiles, Latam Pass
    quantidade: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    proprietario: Mapped[str] = mapped_column(String, nullable=False, default="titular")  # titular | conjuge
    vencimento: Mapped[date | None] = mapped_column(Date, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProtecaoConfig(Base):
    """Configuração da calculadora de seguro de vida ideal (aba Proteção):
    dependentes/educação, padrão de vida e sucessão patrimonial. Guardado como
    JSONB porque a forma é livre e evolui na tela -- o backend só persiste e
    devolve; o cálculo do total fica no frontend (que já tem patrimônio/médias)."""

    __tablename__ = "protecao_config"

    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), primary_key=True
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PlanoInvestimentoConfig(Base):
    """Distribuição planejada da meta MENSAL de investimentos entre os 3 baldes
    (reserva de emergência, projetos, independência financeira). É a INTENÇÃO de
    como dividir os aportes futuros -- guardada como JSONB, cálculo no frontend."""

    __tablename__ = "plano_investimento_config"

    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="CASCADE"), primary_key=True
    )
    profissional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profissionais.id", ondelete="CASCADE"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
