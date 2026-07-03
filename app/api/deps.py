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

from app.core.security import decodificar_access_token
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
        db.execute(text("SET LOCAL app.current_profissional_id = :pid"), {"pid": str(profissional_id)})
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
