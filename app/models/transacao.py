import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.tag import Tag, transacoes_tags


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
    contexto: Mapped[str] = mapped_column(String, default="PF")  # PF | PJ (controle da empresa)
    # categoria_id/subcategoria_id/instituicao_id ficam como UUID simples (sem
    # ForeignKey() no lado do SQLAlchemy) porque instituicao_id ainda aponta pra
    # uma tabela sem model Python -- se um dos três virar FK e os outros não, o
    # DELETE de Transacao passa a exigir cuidado extra; mais simples manter os
    # três iguais. A FK real já existe no banco (schema_seguranca.sql) pra todos.
    categoria_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    subcategoria_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    instituicao_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    cartao_nome: Mapped[str | None] = mapped_column(String, nullable=True)
    cartao_ultimos_digitos: Mapped[str | None] = mapped_column(String, nullable=True)
    parcela_atual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parcela_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Parcela futura projetada (ainda não caiu numa fatura real) -- gerada
    # sob demanda quando o cliente importa uma compra parcelada e pede pra ver
    # as parcelas dos próximos meses. Substituída pela real quando ela chega.
    previsto: Mapped[bool] = mapped_column(Boolean, default=False)
    # Identidade do parcelamento (conta + estabelecimento + total + valor +
    # número da parcela) usada pra reconciliar previsto x real sem depender da
    # data/formatação exata. Ver _hash_parcela em app/api/routes/importacoes.py.
    hash_parcela: Mapped[str | None] = mapped_column(String, nullable=True)
    conciliado: Mapped[bool] = mapped_column(Boolean, default=False)
    # Mês em que o gasto "conta" pro cliente (1º dia do mês) -- por padrão é
    # o mês calendário de `data`; quando a preferência é "virada do cartão" e
    # o cartão tem dia_virada configurado, compras feitas depois da virada
    # contam pro mês seguinte (ver _calcular_mes_referencia).
    mes_referencia: Mapped[date | None] = mapped_column(Date, nullable=True)
    importacao_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("importacoes_extrato.id", ondelete="SET NULL"), nullable=True
    )
    # Vínculo opcional: esta parcela abate desta dívida cadastrada (aba Dívidas).
    divida_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dividas.id", ondelete="SET NULL"), nullable=True
    )
    hash_dedup: Mapped[str] = mapped_column(String, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Quando o lançamento foi editado pela última vez (categoria, etc.) -- não
    # confundir com criado_em. Usado pra saber qual classificação é a mais
    # RECENTE ao reaproveitar o histórico do cliente (ver
    # aplicar_classificacao_por_historico em app/api/routes/importacoes.py).
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # lazy="selectin": carrega as tags junto em toda leitura (2 queries no
    # total, não N+1), sem precisar de .options() em cada rota que lê Transacao.
    tags: Mapped[list["Tag"]] = relationship(secondary=transacoes_tags, lazy="selectin")
