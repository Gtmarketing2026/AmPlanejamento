import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ImportacaoResposta(BaseModel):
    id: uuid.UUID
    cliente_id: uuid.UUID
    tipo_documento: str
    formato_arquivo: str
    periodo_inicio: date | None
    periodo_fim: date | None
    status: str
    transacoes_importadas: int
    transacoes_duplicadas: int
    erro_detalhe: str | None
    criado_em: datetime
    processado_em: datetime | None
    # Conta/cartão ao qual a importação foi associada (ver ContaConectada.natureza).
    conta_natureza: str | None = None  # conta | cartao
    conta_nome: str | None = None
    # Mês(es) de referência dos lançamentos dessa importação (min/max do
    # mes_referencia deles — respeita a virada do cartão). Um só mês => iguais.
    mes_ref_inicio: date | None = None
    mes_ref_fim: date | None = None
    # Só na resposta do upload: quantas compras parceladas têm parcelas futuras
    # que podem ser geradas (o frontend pergunta se o usuário quer gerá-las).
    parcelamentos_detectados: int = 0
    # Quantos lançamentos novos ainda estão sem categoria após a etapa síncrona
    # -- o frontend só dispara a classificação por IA (e o aviso visual) quando
    # isto é > 0, pra não mostrar "IA classificando" quando não há o que fazer.
    transacoes_sem_categoria: int = 0
    # True quando esta fatura precisou ser lida por OCR (leitura de imagem) --
    # o frontend avisa pra conferir, já que OCR pode escapar algum lançamento.
    lido_por_ocr: bool = False

    model_config = {"from_attributes": True}


class ReclassificarRequest(BaseModel):
    ids: list[uuid.UUID]  # lançamentos a reclassificar por IA (o período/filtro atual)


class MesReferenciaAtualizar(BaseModel):
    # Define/ajusta o mês de referência de TODOS os lançamentos de uma
    # importação (o frontend manda o 1º dia do mês escolhido).
    mes_referencia: date


class ContaImportacaoAtualizar(BaseModel):
    # Reatribui TODOS os lançamentos de uma importação a uma conta/cartão de uma
    # vez (ex: fatura importada "sem conta" que precisa apontar pro cartão pra
    # abater do limite). null = desvincula. Recalcula o mês de referência.
    conta_conectada_id: uuid.UUID | None = None


class TransacaoAtualizar(BaseModel):
    categoria_id: uuid.UUID | None = None
    subcategoria_id: uuid.UUID | None = None
    # Reatribuir o lançamento a outra conta/cartão (ou soltar dele com null) --
    # ex: fatura importada "sem conta específica" que precisa apontar pro cartão
    # certo pra abater do limite. Recalcula o mês de referência ao mudar.
    conta_conectada_id: uuid.UUID | None = None
    # Vincular esta parcela a uma dívida cadastrada (abate do saldo dela) -- ou
    # desvincular com null. Só aplicado quando enviado explicitamente.
    divida_id: uuid.UUID | None = None
    # Substitui o CONJUNTO de tags do lançamento (lista vazia = remove todas).
    # Só aplicado quando enviado explicitamente (None = não mexe nas tags).
    tag_ids: list[uuid.UUID] | None = None
    # Se true, aplica a mesma categoria/subcategoria a todos os lançamentos
    # do cliente com a mesma descrição (ex: reclassificar "UBER" uma vez e
    # já valer pra todos os "UBER" existentes).
    aplicar_a_todos_iguais: bool = False


class EnviarEmpresa(BaseModel):
    acao: str  # 'copiar' (fica nos dois) | 'mover' (só no PJ)


class TransacaoCriar(BaseModel):
    """Lançamento manual (não veio de importação de arquivo) -- ex: o
    cliente digitando um gasto em dinheiro na hora."""

    data: date
    descricao: str
    valor: float
    tipo: str  # entrada | saida
    categoria_id: uuid.UUID | None = None
    subcategoria_id: uuid.UUID | None = None
    conta_conectada_id: uuid.UUID | None = None
    contexto: str = "PF"  # PF | PJ
    parcelas: int = 1  # >1 gera as parcelas futuras (previstas) automaticamente
    divida_id: uuid.UUID | None = None  # opcional: abate desta dívida cadastrada
    tag_ids: list[uuid.UUID] = []


class TagCriar(BaseModel):
    nome: str


class TagResposta(BaseModel):
    id: uuid.UUID
    nome: str
    criado_em: datetime

    model_config = {"from_attributes": True}


class TransacaoResposta(BaseModel):
    id: uuid.UUID
    data: date
    descricao: str
    valor: float
    tipo: str
    origem: str
    conciliado: bool
    categoria_id: uuid.UUID | None
    subcategoria_id: uuid.UUID | None
    importacao_id: uuid.UUID | None
    conta_conectada_id: uuid.UUID | None = None
    divida_id: uuid.UUID | None = None
    mes_referencia: date | None = None
    parcela_atual: int | None = None
    parcela_total: int | None = None
    previsto: bool = False
    contexto: str = "PF"
    tags: list[TagResposta] = []
    criado_em: datetime
    # Só preenchido quando a reclassificação usou aplicar_a_todos_iguais --
    # quantos outros lançamentos também foram atualizados junto.
    quantidade_atualizada: int | None = None

    model_config = {"from_attributes": True}
