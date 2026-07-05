import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import (
    exigir_plano_ativo,
    get_cliente_id_atual,
    get_db_admin,
    get_db_com_rls,
    get_db_sem_rls,
    get_profissional_id_atual,
)
from app.core.config import settings
from app.core.security import criar_access_token, hash_senha, verificar_senha
from app.db.base import SessionLocalAdmin
from app.models.categoria import Categoria, Subcategoria
from app.models.cliente import Cliente
from app.models.transacao import Transacao
from app.schemas.categoria import CategoriaResposta, SubcategoriaResposta
from app.schemas.cliente import (
    ClienteAtualizar,
    ClienteCriar,
    ClienteExcluir,
    ClienteLoginRequest,
    ClienteResposta,
    TokenResponse,
)
from app.schemas.importacao import TransacaoAtualizar, TransacaoResposta

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=list[ClienteResposta])
def listar_clientes(db: Session = Depends(get_db_com_rls)):
    # Graças ao RLS, esta query já vem filtrada para o profissional autenticado
    # mesmo sem WHERE explícito — mas mantemos o filtro de status por clareza.
    clientes = db.scalars(select(Cliente).where(Cliente.status == "ativo")).all()
    return clientes


@router.post("", response_model=ClienteResposta, status_code=status.HTTP_201_CREATED)
def criar_cliente(
    dados: ClienteCriar,
    db: Session = Depends(get_db_com_rls),
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
    _plano: uuid.UUID = Depends(exigir_plano_ativo),  # 402 se não tem plano ativo
):
    # nickname é único globalmente (login do cliente final não sabe o
    # subdomínio do profissional antecipadamente) — checagem via conexão
    # privilegiada, porque RLS restringiria a busca só aos clientes do
    # profissional atual, deixando passar duplicata de outro tenant.
    with SessionLocalAdmin() as db_admin:
        ja_existe_nickname = db_admin.scalar(select(Cliente).where(Cliente.nickname == dados.nickname))
    if ja_existe_nickname:
        raise HTTPException(status_code=400, detail="Nickname já está em uso")

    # Nota: isto é ilustrativo — em produção, usar select(func.count()) em vez
    # de carregar o objeto. Mantido simples aqui para foco na regra de negócio.
    qtd_ativos = len(db.scalars(select(Cliente).where(Cliente.status == "ativo")).all())

    cliente = Cliente(
        profissional_id=profissional_id,
        nome=dados.nome,
        tipo=dados.tipo,
        documento=dados.documento,
        cnpj=dados.cnpj,
        nome_pj=dados.nome_pj,
        nickname=dados.nickname,
        senha_hash=hash_senha(dados.senha),
        valor_honorario_mensal=dados.valor_honorario_mensal,
        perfil_comportamental=dados.perfil_comportamental,
        objetivo_principal=dados.objetivo_principal,
        data_cadastro=date.today(),
    )
    db.add(cliente)
    db.flush()

    # Cadastrar já cobra o ciclo atual integral (regra fechada anteriormente).
    # A geração da cobrança em si é responsabilidade do job de faturamento,
    # não desta rota — aqui só garantimos que o cliente entrou no cômputo
    # do próximo fechamento de ciclo.
    if qtd_ativos >= settings.CLIENTES_INCLUSOS_PLANO_BASE:
        # Sinalização para o frontend mostrar o aviso de cliente extra.
        # (não bloqueia a criação — cliente extra é permitido, só é cobrado)
        pass

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
        with SessionLocalAdmin() as db_admin:
            ja_existe_nickname = db_admin.scalar(
                select(Cliente).where(Cliente.nickname == novo_nickname, Cliente.id != cliente_id)
            )
        if ja_existe_nickname:
            raise HTTPException(status_code=400, detail="Nickname já está em uso")
        cliente.nickname = novo_nickname

    nova_senha = dados_informados.pop("senha", None)
    if nova_senha:
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


@router.post("/login", response_model=TokenResponse)
def login_cliente(dados: ClienteLoginRequest, db: Session = Depends(get_db_sem_rls)):
    # get_db_sem_rls já usa a conexão privilegiada — necessário aqui porque
    # login busca por nickname sem ainda saber o profissional_id (RLS de
    # clientes bloquearia a busca, igual ao login de profissional).
    cliente = db.scalar(select(Cliente).where(Cliente.nickname == dados.nickname))
    if not cliente or not cliente.senha_hash or not verificar_senha(dados.senha, cliente.senha_hash):
        raise HTTPException(status_code=401, detail="Nickname ou senha inválidos")

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


@router.get("/eu/categorias", response_model=list[CategoriaResposta])
def listar_minhas_categorias(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    # Sem contexto de profissional_id no token do cliente final -- busca o
    # profissional dono do cadastro pra replicar manualmente a mesma regra
    # da policy de RLS (padrão do sistema OR custom do próprio profissional).
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    return db.scalars(
        select(Categoria)
        .where((Categoria.profissional_id.is_(None)) | (Categoria.profissional_id == cliente.profissional_id))
        .order_by(Categoria.nome)
    ).all()


@router.get("/eu/subcategorias", response_model=list[SubcategoriaResposta])
def listar_minhas_subcategorias(
    categoria_id: uuid.UUID | None = None,
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")
    query = select(Subcategoria).where(
        (Subcategoria.profissional_id.is_(None)) | (Subcategoria.profissional_id == cliente.profissional_id)
    )
    if categoria_id:
        query = query.where(Subcategoria.categoria_id == categoria_id)
    return db.scalars(query.order_by(Subcategoria.nome)).all()


@router.get("/eu/transacoes", response_model=list[TransacaoResposta])
def listar_minhas_transacoes(
    cliente_id: uuid.UUID = Depends(get_cliente_id_atual),
    db: Session = Depends(get_db_admin),
):
    # Mesmo padrão de /clientes/eu: sem policy de RLS por cliente_id, então a
    # conexão privilegiada é filtrada explicitamente pelo cliente_id do token.
    transacoes = db.scalars(
        select(Transacao).where(Transacao.cliente_id == cliente_id).order_by(Transacao.data.desc())
    ).all()
    return transacoes


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

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(transacao, campo, valor)

    db.add(transacao)
    db.flush()
    db.refresh(transacao)
    return transacao
