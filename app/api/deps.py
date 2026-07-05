"""
Dependências centrais da API.

O ponto mais importante deste arquivo é `get_db_com_rls`: toda rota autenticada
deve usar essa dependência (nunca uma sessão de banco "crua"), porque é ela
que ativa o isolamento multi-tenant (Row Level Security) definindo
`app.current_profissional_id` na transação atual.

Sem isso, as policies de RLS criadas no schema (`isolar_clientes`,
`isolar_faturas` etc.) não têm como saber qual profissional está fazendo
a requisição, e a query simplesmente não retorna nada — o que é seguro
(fail-closed) mas indica bug de integração se acontecer.
"""

import uuid
from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import decodificar_access_token, decodificar_token_admin, decodificar_token_cliente
from app.db.base import SessionLocal, SessionLocalAdmin

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db_sem_rls() -> Generator[Session, None, None]:
    """Uso restrito: só para rotas que ainda não têm profissional autenticado
    (ex: cadastro, login). Nunca usar isso para servir dado de cliente.

    Usa a conexão privilegiada (SessionLocalAdmin) porque a tabela
    `profissionais` também tem RLS: a policy exige já saber o
    profissional_id pra enxergar a linha, mas login/cadastro precisam
    buscar por e-mail ANTES de saber quem é — com a conexão restrita
    (RLS ativo) essa busca sempre voltaria vazia."""
    db = SessionLocalAdmin()
    try:
        yield db
    finally:
        db.close()


def get_profissional_id_atual(token: str = Depends(oauth2_scheme)) -> uuid.UUID:
    profissional_id = decodificar_access_token(token)
    if not profissional_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return uuid.UUID(profissional_id)


def get_cliente_id_atual(token: str = Depends(oauth2_scheme)) -> uuid.UUID:
    """Gate pras rotas do cliente final (ex: GET /clientes/eu) — nunca aceita
    um token de profissional aqui, mesmo que o sub seja um UUID válido."""
    cliente_id = decodificar_token_cliente(token)
    if not cliente_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return uuid.UUID(cliente_id)


def get_db_com_rls(
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
) -> Generator[Session, None, None]:
    """Sessão de banco com o contexto de RLS já configurado para o
    profissional autenticado na requisição atual."""
    db = SessionLocal()
    try:
        # SET LOCAL vale só para a transação atual — por isso precisa ser a
        # primeira coisa executada na sessão, e a sessão não pode ser reusada
        # entre requisições de profissionais diferentes.
        #
        # app.is_admin também precisa ser setado (como 'false') aqui, mesmo
        # essa rota não sendo de admin: numa conexão do pool reaproveitada de
        # uma request anterior que passou por get_db_negocio, essa GUC fica
        # "suja" em '' (Postgres trata GUC placeholder como string vazia, não
        # NULL, depois que a transação que deu SET LOCAL comita) -- e a
        # policy faz `current_setting('app.is_admin', true)::boolean`
        # incondicionalmente, que explode com '' antes mesmo de chegar no
        # current_profissional_id. Sem isso aqui, toda rota comum quebra
        # depois da primeira chamada de rota admin na mesma conexão do pool.
        db.execute(text("SET LOCAL app.current_profissional_id = :pid"), {"pid": str(profissional_id)})
        db.execute(text("SET LOCAL app.is_admin = 'false'"))
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_db_admin() -> Generator[Session, None, None]:
    """Conexão privilegiada (ignora RLS) — usada pelas rotas do cliente final
    que precisam ler o próprio registro/categorias/transações sem contexto
    de RLS por profissional_id (ex: GET /clientes/eu). O antigo painel de
    suporte interno que também usava essa conexão (profissionais.is_admin)
    foi substituído pelo nível Negócio (get_db_negocio, abaixo) — ver
    CLAUDE.md, seção "Três níveis de acesso"."""
    db = SessionLocalAdmin()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ============================================================================
# Nível "Negócio" (tabela `admins`) -- bypass de RLS via a GUC `app.is_admin`
# na MESMA conexão restrita (app_fluxo/RLS), como descrito no aviso de
# segurança do schema_seguranca.sql.
# ============================================================================


def get_admin_id_atual(token: str = Depends(oauth2_scheme)) -> uuid.UUID:
    """Gate pras rotas do nível Negócio — nunca aceita token de profissional
    ou de cliente_final aqui, mesmo que o sub seja um UUID válido."""
    admin_id = decodificar_token_admin(token)
    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return uuid.UUID(admin_id)


def exigir_plano_ativo(
    profissional_id: uuid.UUID = Depends(get_profissional_id_atual),
) -> uuid.UUID:
    """Gate de plano: 402 se o profissional ainda não tem plano ativo (nem
    trial nem fatura paga). Usar nas rotas que são "usar o produto" (ex:
    cadastrar cliente) -- cadastrar/logar/escolher plano NÃO passam por aqui."""
    from app.core.planos import tem_plano_ativo
    from app.models.profissional import Profissional

    db = SessionLocal()
    try:
        db.execute(text("SET LOCAL app.current_profissional_id = :pid"), {"pid": str(profissional_id)})
        db.execute(text("SET LOCAL app.is_admin = 'false'"))
        profissional = db.get(Profissional, profissional_id)
        ativo = profissional is not None and tem_plano_ativo(db, profissional)
        db.commit()
    finally:
        db.close()

    if not ativo:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Escolha e pague um plano para usar o Fluxo.",
        )
    return profissional_id


def get_db_negocio(
    admin_id: uuid.UUID = Depends(get_admin_id_atual),
) -> Generator[Session, None, None]:
    """Sessão de banco com `app.is_admin` setado como true — SÓ depois que
    `get_admin_id_atual` já validou um JWT de admin genuíno (tabela `admins`).

    NUNCA setar essa GUC a partir de header, query param ou body da
    requisição — o valor só pode vir daqui, depois da validação acima. Ver o
    aviso de segurança em schema_seguranca.sql logo antes das policies de
    RLS: se essa variável puder ser forjada por qualquer request, todo o
    isolamento multi-tenant do banco é anulado de uma vez.

    Usa a conexão RESTRITA (app_fluxo, SessionLocal) — o bypass é só a GUC,
    não uma segunda conexão privilegiada."""
    db = SessionLocal()
    try:
        # `app.current_profissional_id` também precisa ser setado aqui, com um
        # UUID nulo/inofensivo (nunca vai bater com um profissional real) --
        # sem isso, numa conexão do pool reaproveitada de uma request anterior
        # que passou por get_db_com_rls, essa GUC "suja" fica como '' (string
        # vazia, não NULL — comportamento do Postgres pra GUC placeholder
        # depois que a transação que deu SET LOCAL comita). As policies fazem
        # `current_setting(...)::UUID` incondicionalmente do lado esquerdo do
        # OR, e Postgres tenta o cast antes de decidir o OR -- '' explode com
        # "invalid input syntax for type uuid". Setando um UUID válido (ainda
        # que nulo) aqui, o cast nunca falha, e o bypass de app.is_admin segue
        # cobrindo a visibilidade normalmente.
        db.execute(text("SET LOCAL app.current_profissional_id = '00000000-0000-0000-0000-000000000000'"))
        db.execute(text("SET LOCAL app.is_admin = 'true'"))
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
