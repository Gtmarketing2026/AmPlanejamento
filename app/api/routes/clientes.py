import re
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.api.deps import (
    exigir_plano_ativo,
    get_cliente_id_atual,
    get_db_admin,
    get_db_com_rls,
    get_db_sem_rls,
    get_profissional_id_atual,
)
from app.api.routes.importacoes import (
    _calcular_mes_referencia,
    _estabelecimento,
    _hash_parcela,
    _monta_importacao_resposta,
    _obter_conta_do_upload,
    gerar_parcelas_futuras,
    meses_ref_por_importacao,
    processar_upload,
    projetar_parcelas_de_origem,
)
from app.core.config import settings
from app.core.rate_limit import limpar, registrar_falha, verificar_bloqueio
from app.core.security import criar_access_token, hash_senha, verificar_senha
from app.core.validacao import validar_senha_forte
from app.db.base import SessionLocalAdmin
from app.integrations.supabase_storage import excluir_arquivo
from app.models.categoria import Categoria, Subcategoria
from app.models.cliente import Cliente
from app.models.conta_conectada import ContaConectada
from app.models.importacao_extrato import ImportacaoExtrato
from app.models.preferencia_cliente import PreferenciaCliente
from app.models.transacao import Transacao
from app.parsers.dedup import calcular_hash_dedup
from app.schemas.categoria import (
    CONTEXTOS,
    TIPOS,
    CategoriaAtualizar,
    CategoriaCriar,
    CategoriaResposta,
    SubcategoriaAtualizar,
    SubcategoriaCriar,
    SubcategoriaResposta,
)
from app.schemas.cliente import (
    ClienteAtualizar,
    ClienteCriar,
    ClienteExcluir,
    ClienteLoginRequest,
    ClienteResposta,
    TokenResponse,
)
from app.schemas.importacao import (
    EnviarEmpresa,
    ImportacaoResposta,
    MesReferenciaAtualizar,
    TransacaoAtualizar,
    TransacaoCriar,
    TransacaoResposta,
)

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=list[ClienteResposta])
def listar_clientes(db: Session = Depends(get_db_com_rls)):
    # Graças ao RLS, esta query já vem filtrada para o profissional autenticado
    # mesmo sem WHERE explícito — mas mantemos o filtro de status por clareza.
    clientes = db.scalars(select(Cliente).where(Cliente.status == "ativo")).all()
    return clientes


def _nickname_em_uso(nickname: str | None, ignorar_id: uuid.UUID | None = None) -> bool:
    """O nickname é o login global do cliente -- precisa ser único ENTRE OS
    NÃO EXCLUÍDOS (índice parcial no banco). Um cliente excluído não segura o
    nickname refém. Checagem via conexão privilegiada porque o RLS restringiria
    a busca só ao próprio tenant, deixando passar duplicata de outro planejador."""
    if not nickname:
        return False
    with SessionLocalAdmin() as db_admin:
        q = select(Cliente).where(Cliente.nickname == nickname, Cliente.status != "excluido")
        if ignorar_id is not None:
            q = q.where(Cliente.id != ignorar_id)
        return db_admin.scalar(q) is not None


@router.post("", response_model=ClienteResposta, status_code=status.HTTP_201_CREATED)
def criar_cliente(
    dados: ClienteCriar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    _plano: uuid.UUID = Depends(exigir_plano_ativo),  # 402 se não tem plano ativo
):
    # Duplicidade por CPF DENTRO deste planejador (RLS já filtra o tenant):
    #  - se existe um ATIVO com o mesmo CPF -> é duplicata real, bloqueia;
    #  - se existe um EXCLUÍDO com o mesmo CPF -> REATIVA (traz de volta com o
    #    histórico), em vez de barrar como "já cadastrado". Assim, excluir e
    #    recadastrar o mesmo cliente funciona. Outro planejador não é afetado
    #    (CPF não é único global; o RLS não enxerga clientes de outro tenant).
    mesmos_cpf = db.scalars(
        select(Cliente).where(Cliente.documento == dados.documento).order_by(Cliente.criado_em.desc())
    ).all()
    if any(c.status == "ativo" for c in mesmos_cpf):
        raise HTTPException(status_code=400, detail="Você já tem um cliente ativo com esse CPF.")

    reativar = next((c for c in mesmos_cpf if c.status == "excluido"), None)
    # Existe um cadastro anterior EXCLUÍDO com esse CPF e o planejador ainda
    # não escolheu o que fazer -> devolve 409 pedindo a decisão (o frontend
    # pergunta "recuperar histórico" ou "começar do zero").
    if reativar is not None and dados.recuperar_historico is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "codigo": "cliente_excluido_existe",
                "mensagem": "Já existe um cadastro anterior deste CPF, que foi excluído.",
                "cliente_id": str(reativar.id),
                "nome": reativar.nome,
                "data_exclusao": reativar.data_exclusao.isoformat() if reativar.data_exclusao else None,
            },
        )

    if reativar is not None and dados.recuperar_historico is True:
        if _nickname_em_uso(dados.nickname, ignorar_id=reativar.id):
            raise HTTPException(status_code=400, detail="Nickname já está em uso")
        validar_senha_forte(dados.senha)
        reativar.status = "ativo"
        reativar.data_exclusao = None
        reativar.motivo_churn = None
        reativar.motivo_churn_detalhe = None
        reativar.conexao_pausada = False
        reativar.nome = dados.nome
        reativar.tipo = dados.tipo
        reativar.cnpj = dados.cnpj
        reativar.nome_pj = dados.nome_pj
        reativar.nickname = dados.nickname
        reativar.senha_hash = hash_senha(dados.senha)
        reativar.valor_honorario_mensal = dados.valor_honorario_mensal
        reativar.perfil_comportamental = dados.perfil_comportamental
        reativar.objetivo_principal = dados.objetivo_principal
        reativar.data_cadastro = date.today()  # nova relação recomeça hoje
        db.add(reativar)
        db.flush()
        db.refresh(reativar)
        return reativar

    if _nickname_em_uso(dados.nickname):
        raise HTTPException(status_code=400, detail="Nickname já está em uso")

    cliente = Cliente(
        profissional_id=profissional_id,
        nome=dados.nome,
        tipo=dados.tipo,
        documento=dados.documento,
        cnpj=dados.cnpj,
        nome_pj=dados.nome_pj,
        nickname=dados.nickname,
        senha_hash=(validar_senha_forte(dados.senha) or hash_senha(dados.senha)),
        valor_honorario_mensal=dados.valor_honorario_mensal,
        perfil_comportamental=dados.perfil_comportamental,
        objetivo_principal=dados.objetivo_principal,
        data_cadastro=date.today(),
    )
    db.add(cliente)
    db.flush()
    db.refresh(cliente)
    return cliente


@router.patch("/{cliente_id}", response_model=ClienteResposta)
def atualizar_cliente(
    cliente_id: uuid.UUID,
    dados: ClienteAtualizar,
    db: Session = Depends(get_db_com_rls),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        # RLS já garante que só clientes do próprio profissional aparecem aqui.
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    dados_informados = dados.model_dump(exclude_unset=True)

    novo_nickname = dados_informados.pop("nickname", None)
    if novo_nickname and novo_nickname != cliente.nickname:
        if _nickname_em_uso(novo_nickname, ignorar_id=cliente_id):
            raise HTTPException(status_code=400, detail="Nickname já está em uso")
        cliente.nickname = novo_nickname

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
        validar_senha_forte(nova_senha)
        cliente.senha_hash = hash_senha(nova_senha)

    for campo, valor in dados_informados.items():
        setattr(cliente, campo, valor)

    db.add(cliente)
    db.flush()
    db.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}", status_code=status.HTTP_200_OK)
def excluir_cliente(
    cliente_id: uuid.UUID,
    dados: ClienteExcluir,
    db: Session = Depends(get_db_com_rls),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        # Por causa do RLS, um cliente de outro profissional simplesmente
        # não é encontrado aqui — não vaza informação sobre existência dele.
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    hoje = date.today()
    dentro_do_prazo = hoje <= cliente.data_limite_exclusao

    cliente.status = "excluido"
    cliente.data_exclusao = hoje
    cliente.motivo_churn = dados.motivo_churn
    cliente.motivo_churn_detalhe = dados.motivo_churn_detalhe
    db.add(cliente)

    return {
        "gerara_cobranca_proximo_ciclo": not dentro_do_prazo,
        "data_limite_que_era": cliente.data_limite_exclusao,
    }


@router.post("/{cliente_id}/abrir-painel", response_model=TokenResponse)
def abrir_painel_do_cliente(
    cliente_id: uuid.UUID,
    db: Session = Depends(get_db_com_rls),
):
    """O planejador abre o painel REAL do próprio cliente (não o mock antigo).
    Emite um token de cliente_final para ESTE cliente — o RLS garante que
    `db.get` só encontra clientes do profissional autenticado, então o
    planejador nunca consegue abrir o painel de um cliente de outro tenant."""
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    token = criar_access_token(str(cliente_id), tipo="cliente_final")
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login_cliente(dados: ClienteLoginRequest, db: Session = Depends(get_db_sem_rls)):
    # get_db_sem_rls já usa a conexão privilegiada — necessário aqui porque
    # login busca por nickname sem ainda saber o profissional_id (RLS de
    # clientes bloquearia a busca, igual ao login de profissional).
    chave = f"cliente:{(dados.nickname or '').lower()}"
    verificar_bloqueio(chave)

    cliente = db.scalar(select(Cliente).where(Cliente.nickname == dados.nickname))
    if not cliente or not cliente.senha_hash or not verificar_senha(dados.senha, cliente.senha_hash):
        registrar_falha(chave)
        raise HTTPException(status_code=401, detail="Nickname ou senha inválidos")

    limpar(chave)
    if cliente.status == "excluido":
        raise HTTPException(status_code=403, detail="Cadastro encerrado. Fale com seu planejador.")

    token = criar_access_token(str(cliente.id), tipo="cliente_final")
    return TokenResponse(access_token=token)


@router.get("/eu", response_model=ClienteResposta)
def perfil_cliente_atual(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    # Não há policy de RLS por cliente_id (só por profissional_id) -- por
    # isso usa a conexão privilegiada, mas o filtro abaixo por cliente_id
    # (vindo do token já validado) garante que só o próprio cliente é lido.
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    return cliente


def _categoria_resposta_cliente(c: Categoria, cliente_id: uuid.UUID) -> CategoriaResposta:
    return CategoriaResposta.model_validate(c).model_copy(update={"editavel": c.cliente_id == cliente_id})


def _subcategoria_resposta_cliente(s: Subcategoria, cliente_id: uuid.UUID) -> SubcategoriaResposta:
    return SubcategoriaResposta.model_validate(s).model_copy(update={"editavel": s.cliente_id == cliente_id})


def _exigir_cliente_para_categorias(db: Session, cliente_id: uuid.UUID) -> Cliente:
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    return cliente


@router.get("/eu/categorias", response_model=list[CategoriaResposta])
def listar_minhas_categorias(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    # Sem contexto de profissional_id no token do cliente final -- busca o
    # profissional dono do cadastro pra replicar manualmente a mesma regra
    # da policy de RLS (padrão do sistema OR compartilhada do profissional
    # OR só deste cliente).
    cliente = _exigir_cliente_para_categorias(db, cliente_id)
    categorias = db.scalars(
        select(Categoria)
        .where(
            (Categoria.profissional_id.is_(None))
            | ((Categoria.profissional_id == cliente.profissional_id) & (Categoria.cliente_id.is_(None)))
            | (Categoria.cliente_id == cliente_id)
        )
        .order_by(Categoria.nome)
    ).all()
    return [_categoria_resposta_cliente(c, cliente_id) for c in categorias]


@router.post("/eu/categorias", response_model=CategoriaResposta, status_code=status.HTTP_201_CREATED)
def criar_minha_categoria(
    dados: CategoriaCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente_para_categorias(db, cliente_id)
    if dados.tipo not in TIPOS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Tipo inválido: {dados.tipo}")
    if dados.contexto not in CONTEXTOS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Contexto inválido: {dados.contexto}")
    categoria = Categoria(
        profissional_id=cliente.profissional_id,
        cliente_id=cliente_id,
        nome=dados.nome,
        tipo=dados.tipo,
        icone=dados.icone,
        contexto=dados.contexto,
    )
    db.add(categoria)
    db.flush()
    db.refresh(categoria)
    return _categoria_resposta_cliente(categoria, cliente_id)


def _exigir_minha_categoria(db: Session, categoria_id: uuid.UUID, cliente_id: uuid.UUID) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None or categoria.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    return categoria


@router.patch("/eu/categorias/{categoria_id}", response_model=CategoriaResposta)
def atualizar_minha_categoria(
    categoria_id: uuid.UUID,
    dados: CategoriaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    categoria = _exigir_minha_categoria(db, categoria_id, cliente_id)
    if dados.contexto is not None and dados.contexto not in CONTEXTOS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Contexto inválido: {dados.contexto}")
    if dados.nome is not None:
        categoria.nome = dados.nome
    if dados.icone is not None:
        categoria.icone = dados.icone
    if dados.contexto is not None:
        categoria.contexto = dados.contexto
    db.flush()
    db.refresh(categoria)
    return _categoria_resposta_cliente(categoria, cliente_id)


@router.delete("/eu/categorias/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_minha_categoria(
    categoria_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    categoria = _exigir_minha_categoria(db, categoria_id, cliente_id)
    sub_ids = list(db.scalars(select(Subcategoria.id).where(Subcategoria.categoria_id == categoria_id)))
    db.query(Transacao).filter(Transacao.cliente_id == cliente_id, Transacao.categoria_id == categoria_id).update(
        {"categoria_id": None, "subcategoria_id": None}, synchronize_session=False
    )
    if sub_ids:
        db.query(Transacao).filter(
            Transacao.cliente_id == cliente_id, Transacao.subcategoria_id.in_(sub_ids)
        ).update({"subcategoria_id": None}, synchronize_session=False)
    db.delete(categoria)


@router.get("/eu/subcategorias", response_model=list[SubcategoriaResposta])
def listar_minhas_subcategorias(
    categoria_id: uuid.UUID | None = None,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente_para_categorias(db, cliente_id)
    query = select(Subcategoria).where(
        (Subcategoria.profissional_id.is_(None))
        | ((Subcategoria.profissional_id == cliente.profissional_id) & (Subcategoria.cliente_id.is_(None)))
        | (Subcategoria.cliente_id == cliente_id)
    )
    if categoria_id:
        query = query.where(Subcategoria.categoria_id == categoria_id)
    return [_subcategoria_resposta_cliente(s, cliente_id) for s in db.scalars(query.order_by(Subcategoria.nome)).all()]


@router.post("/eu/subcategorias", response_model=SubcategoriaResposta, status_code=status.HTTP_201_CREATED)
def criar_minha_subcategoria(
    dados: SubcategoriaCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = _exigir_cliente_para_categorias(db, cliente_id)
    categoria = db.get(Categoria, dados.categoria_id)
    if categoria is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    subcategoria = Subcategoria(
        categoria_id=dados.categoria_id,
        profissional_id=cliente.profissional_id,
        cliente_id=cliente_id,
        nome=dados.nome,
    )
    db.add(subcategoria)
    db.flush()
    db.refresh(subcategoria)
    return _subcategoria_resposta_cliente(subcategoria, cliente_id)


def _exigir_minha_subcategoria(db: Session, subcategoria_id: uuid.UUID, cliente_id: uuid.UUID) -> Subcategoria:
    subcategoria = db.get(Subcategoria, subcategoria_id)
    if subcategoria is None or subcategoria.cliente_id != cliente_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subcategoria não encontrada")
    return subcategoria


@router.patch("/eu/subcategorias/{subcategoria_id}", response_model=SubcategoriaResposta)
def atualizar_minha_subcategoria(
    subcategoria_id: uuid.UUID,
    dados: SubcategoriaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    subcategoria = _exigir_minha_subcategoria(db, subcategoria_id, cliente_id)
    subcategoria.nome = dados.nome
    db.flush()
    db.refresh(subcategoria)
    return _subcategoria_resposta_cliente(subcategoria, cliente_id)


@router.delete("/eu/subcategorias/{subcategoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_minha_subcategoria(
    subcategoria_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    subcategoria = _exigir_minha_subcategoria(db, subcategoria_id, cliente_id)
    db.query(Transacao).filter(
        Transacao.cliente_id == cliente_id, Transacao.subcategoria_id == subcategoria_id
    ).update({"subcategoria_id": None}, synchronize_session=False)
    db.delete(subcategoria)


@router.get("/eu/transacoes", response_model=list[TransacaoResposta])
def listar_minhas_transacoes(
    busca: str | None = None,
    categoria_id: uuid.UUID | None = None,
    subcategoria_id: uuid.UUID | None = None,
    conta_conectada_id: uuid.UUID | None = None,  # filtro por conta/cartão
    tipo: str | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    mes_referencia: date | None = None,
    incluir_previstos: bool = False,
    contexto: str | None = None,  # 'PF' | 'PJ' -- separa pessoal do controle da empresa
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    # Mesmo padrão de /clientes/eu: sem policy de RLS por cliente_id, então a
    # conexão privilegiada é filtrada explicitamente pelo cliente_id do token.
    query = select(Transacao).where(Transacao.cliente_id == cliente_id)
    if contexto in ("PF", "PJ"):
        query = query.where(Transacao.contexto == contexto)
    # Parcelas futuras (previsto=True) ficam de fora por padrão pra não poluir
    # os totais do "agora"; só entram quando pedido explicitamente (ex: visão
    # por mês no Fluxo de caixa).
    if not incluir_previstos:
        query = query.where(Transacao.previsto.is_(False))
    if busca:
        query = query.where(Transacao.descricao.ilike(f"%{busca}%"))
    if categoria_id:
        query = query.where(Transacao.categoria_id == categoria_id)
    if subcategoria_id:
        query = query.where(Transacao.subcategoria_id == subcategoria_id)
    if conta_conectada_id:
        query = query.where(Transacao.conta_conectada_id == conta_conectada_id)
    if tipo:
        query = query.where(Transacao.tipo == tipo)
    if data_inicio:
        query = query.where(Transacao.data >= data_inicio)
    if data_fim:
        query = query.where(Transacao.data <= data_fim)
    if mes_referencia:
        query = query.where(Transacao.mes_referencia == mes_referencia)
    transacoes = db.scalars(query.order_by(Transacao.data.desc())).all()
    return transacoes


@router.post("/eu/transacoes", response_model=TransacaoResposta, status_code=status.HTTP_201_CREATED)
def criar_minha_transacao(
    dados: TransacaoCriar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    """Lançamento digitado à mão pelo cliente (ex: gasto em dinheiro que não
    aparece em nenhum extrato). Usa a mesma "conta manual" das importações
    por arquivo e o mesmo hash de dedup, pra nunca duplicar um lançamento já
    existente com a mesma data/valor/descrição."""
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    if dados.tipo not in ("entrada", "saida"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Tipo inválido: use 'entrada' ou 'saida'")

    conta = _obter_conta_do_upload(db, cliente_id, cliente.profissional_id, dados.conta_conectada_id)
    valor = abs(dados.valor) if dados.tipo == "entrada" else -abs(dados.valor)
    # Compra parcelada manual (ex: parcelas=6): o valor informado é o TOTAL,
    # então cada parcela vale total/parcelas. A descrição vira "... (1/6)" e as
    # parcelas 2..6 são geradas como previstas nos meses seguintes (mesma lógica
    # da importação, ver projetar_parcelas_de_origem).
    parcelas = max(1, dados.parcelas)
    descricao = dados.descricao
    parcela_atual = parcela_total = hash_parcela = None
    if parcelas > 1:
        valor = round(valor / parcelas, 2)
        parcela_atual, parcela_total = 1, parcelas
        if not re.search(r"\(\d+\s*/\s*\d+\)", descricao):
            descricao = f"{descricao} (1/{parcelas})"
        hash_parcela = _hash_parcela(conta.id, _estabelecimento(descricao), parcela_total, valor, 1)

    hash_dedup = calcular_hash_dedup(conta.id, dados.data, valor, descricao)

    ja_existe = db.scalar(
        select(Transacao).where(Transacao.conta_conectada_id == conta.id, Transacao.hash_dedup == hash_dedup)
    )
    if ja_existe:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um lançamento igual (mesma data/valor/descrição).")

    preferencia = db.get(PreferenciaCliente, cliente_id)
    modo_visualizacao = preferencia.visualizacao_lancamento if preferencia else "data_compra"
    mes_referencia = _calcular_mes_referencia(dados.data, conta.natureza, conta.dia_virada, modo_visualizacao)

    transacao = Transacao(
        conta_conectada_id=conta.id,
        cliente_id=cliente_id,
        profissional_id=cliente.profissional_id,
        data=dados.data,
        descricao=descricao,
        valor=valor,
        tipo=dados.tipo,
        origem="cartao" if conta.natureza == "cartao" else "conta",
        contexto="PJ" if dados.contexto == "PJ" else "PF",
        categoria_id=dados.categoria_id,
        subcategoria_id=dados.subcategoria_id,
        conciliado=True,
        hash_dedup=hash_dedup,
        mes_referencia=mes_referencia,
        parcela_atual=parcela_atual,
        parcela_total=parcela_total,
        hash_parcela=hash_parcela,
    )
    db.add(transacao)
    db.flush()
    if parcelas > 1:
        db.refresh(transacao)
        projetar_parcelas_de_origem(db, transacao, modo_visualizacao)
    db.refresh(transacao)
    return transacao


@router.patch("/eu/transacoes/{transacao_id}", response_model=TransacaoResposta)
def atualizar_minha_transacao(
    transacao_id: uuid.UUID,
    dados: TransacaoAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    # Reclassificação manual pelo próprio cliente final -- única escrita
    # permitida no dashboard dele, que é read-only pra tudo mais.
    transacao = db.scalar(
        select(Transacao).where(Transacao.id == transacao_id, Transacao.cliente_id == cliente_id)
    )
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    campos = dados.model_dump(exclude_unset=True, exclude={"aplicar_a_todos_iguais"})
    for campo, valor in campos.items():
        setattr(transacao, campo, valor)

    quantidade_atualizada = None
    if dados.aplicar_a_todos_iguais:
        # Reclassifica de uma vez todos os outros lançamentos do mesmo
        # cliente com a MESMA descrição (comparação exata, case-insensitive)
        # -- ex: acertar "UBER" uma vez e já valer pra todos os "UBER"
        # existentes, sem precisar editar um por um.
        outras = db.scalars(
            select(Transacao).where(
                Transacao.cliente_id == cliente_id,
                Transacao.id != transacao_id,
                func.lower(Transacao.descricao) == transacao.descricao.lower(),
            )
        ).all()
        for outra in outras:
            outra.categoria_id = transacao.categoria_id
            outra.subcategoria_id = transacao.subcategoria_id
        quantidade_atualizada = len(outras)

    db.add(transacao)
    db.flush()
    db.refresh(transacao)
    resposta = TransacaoResposta.model_validate(transacao)
    resposta.quantidade_atualizada = quantidade_atualizada
    return resposta


@router.delete("/eu/transacoes/{transacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_minha_transacao(
    transacao_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    transacao = db.scalar(
        select(Transacao).where(Transacao.id == transacao_id, Transacao.cliente_id == cliente_id)
    )
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    db.delete(transacao)


@router.post("/eu/transacoes/{transacao_id}/empresa", response_model=TransacaoResposta)
def enviar_transacao_empresa(
    transacao_id: uuid.UUID,
    dados: EnviarEmpresa,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    """Manda um gasto pro controle da empresa (PJ). 'mover' muda o contexto do
    próprio lançamento; 'copiar' cria uma cópia em PJ (deixando o original em
    PF). A cópia usa hash_dedup com sufixo '|empresa', então copiar de novo o
    mesmo lançamento não duplica."""
    if dados.acao not in ("copiar", "mover"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ação deve ser 'copiar' ou 'mover'")
    cliente = db.get(Cliente, cliente_id)
    if not cliente or not cliente.cnpj:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cliente não tem CNPJ cadastrado")

    transacao = db.scalar(
        select(Transacao).where(Transacao.id == transacao_id, Transacao.cliente_id == cliente_id)
    )
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada")

    if dados.acao == "mover":
        transacao.contexto = "PJ"
        db.flush()
        db.refresh(transacao)
        return transacao

    # copiar -- cópia idempotente em PJ (sufixo no hash pra não colidir com o
    # original PF e pra re-copiar não gerar 2 cópias).
    hash_copia = calcular_hash_dedup(
        transacao.conta_conectada_id, transacao.data, float(transacao.valor),
        (transacao.descricao or "") + "|empresa",
    )
    stmt = (
        pg_insert(Transacao)
        .values(
            conta_conectada_id=transacao.conta_conectada_id,
            cliente_id=cliente_id,
            profissional_id=transacao.profissional_id,
            data=transacao.data,
            descricao=transacao.descricao,
            valor=transacao.valor,
            tipo=transacao.tipo,
            origem=transacao.origem,
            contexto="PJ",
            categoria_id=transacao.categoria_id,
            subcategoria_id=transacao.subcategoria_id,
            conciliado=True,
            hash_dedup=hash_copia,
            mes_referencia=transacao.mes_referencia,
        )
        .on_conflict_do_nothing(index_elements=["conta_conectada_id", "hash_dedup"])
        .returning(Transacao.id)
    )
    linha = db.execute(stmt).first()
    db.flush()
    copia = db.get(Transacao, linha[0]) if linha else transacao
    return copia


# ---------------------------------------------------------------------------
# Importação de extrato/fatura PELO PRÓPRIO CLIENTE (função dele — o
# planejador também pode importar pela rota /importacoes). Usa get_db_admin
# (privilegiada) filtrando sempre pelo cliente_id do token, mesmo padrão dos
# outros /clientes/eu/*.
# ---------------------------------------------------------------------------


@router.post("/eu/importacoes", response_model=ImportacaoResposta, status_code=status.HTTP_201_CREATED)
async def importar_meu_extrato(
    tipo_documento: str = Form(...),
    periodo_inicio: date | None = Form(None),
    periodo_fim: date | None = Form(None),
    senha_pdf: str | None = Form(None),
    conta_conectada_id: uuid.UUID | None = Form(None),
    contexto: str = Form("PF"),
    arquivo: UploadFile = File(...),
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    conteudo = await arquivo.read()
    return processar_upload(
        db, cliente_id, cliente.profissional_id, tipo_documento,
        arquivo.filename or "arquivo", conteudo, periodo_inicio, periodo_fim, "cliente_final",
        senha_pdf=senha_pdf or None, conta_conectada_id=conta_conectada_id, contexto=contexto,
    )


@router.post("/eu/importacoes/{importacao_id}/gerar-parcelas")
def gerar_minhas_parcelas(
    importacao_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    importacao = db.scalar(
        select(ImportacaoExtrato).where(
            ImportacaoExtrato.id == importacao_id, ImportacaoExtrato.cliente_id == cliente_id
        )
    )
    if not importacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importação não encontrada")
    criadas = gerar_parcelas_futuras(db, importacao_id, cliente_id)
    return {"parcelas_criadas": criadas}


@router.get("/eu/importacoes", response_model=list[ImportacaoResposta])
def listar_minhas_importacoes(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    linhas = db.execute(
        select(ImportacaoExtrato, ContaConectada)
        .outerjoin(ContaConectada, ContaConectada.id == ImportacaoExtrato.conta_conectada_id)
        .where(ImportacaoExtrato.cliente_id == cliente_id)
        .order_by(ImportacaoExtrato.criado_em.desc())
    ).all()
    meses = meses_ref_por_importacao(db, [imp.id for imp, _ in linhas])
    return [_monta_importacao_resposta(imp, conta, meses) for imp, conta in linhas]


@router.patch("/eu/importacoes/{importacao_id}/mes-referencia")
def atualizar_mes_ref_minha_importacao(
    importacao_id: uuid.UUID,
    dados: MesReferenciaAtualizar,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    """Ajusta manualmente o mês de referência de TODOS os lançamentos desta
    importação (ex: uma fatura que deve contar toda em julho). Recalcula pro
    1º dia do mês escolhido."""
    imp = db.scalar(
        select(ImportacaoExtrato).where(
            ImportacaoExtrato.id == importacao_id, ImportacaoExtrato.cliente_id == cliente_id
        )
    )
    if not imp:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    mes = dados.mes_referencia.replace(day=1)
    db.execute(
        update(Transacao)
        .where(Transacao.importacao_id == importacao_id, Transacao.cliente_id == cliente_id)
        .values(mes_referencia=mes)
    )
    return {"ok": True, "mes_referencia": mes.isoformat()}


@router.delete("/eu/importacoes/{importacao_id}", status_code=status.HTTP_200_OK)
def excluir_minha_importacao(
    importacao_id: uuid.UUID,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    importacao = db.scalar(
        select(ImportacaoExtrato).where(
            ImportacaoExtrato.id == importacao_id, ImportacaoExtrato.cliente_id == cliente_id
        )
    )
    if not importacao:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importação não encontrada")

    transacoes = db.scalars(select(Transacao).where(Transacao.importacao_id == importacao_id)).all()
    qtd = len(transacoes)
    for t in transacoes:
        db.delete(t)
    try:
        excluir_arquivo(importacao.arquivo_url)
    except Exception:
        pass
    db.delete(importacao)
    db.flush()
    return {"transacoes_removidas": qtd}
