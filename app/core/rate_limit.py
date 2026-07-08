"""
Proteção contra força bruta nos logins. Backed por tabela no Postgres em vez
de memória porque rodamos em serverless (Vercel) -- cada request pode cair
numa instância diferente, então estado em processo não serve.

Usa a conexão privilegiada (SessionLocalAdmin) com transação PRÓPRIA e commit
imediato: o registro da tentativa precisa persistir mesmo quando o login
falha e a request levanta HTTPException (a sessão da request faria rollback).

Chave = "<tipo>:<identificador>" (ex: "profissional:ana@x.com",
"cliente:ana123", "admin:dono@x.com"). Protege contra ataque direcionado a
uma conta específica (credential stuffing / brute force de senha).
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import text

from app.db.base import SessionLocalAdmin

MAX_TENTATIVAS = 5          # falhas permitidas dentro da janela
JANELA_MIN = 15             # janela de contagem (minutos)
BLOQUEIO_MIN = 15           # tempo bloqueado após estourar o limite


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def verificar_bloqueio(chave: str) -> None:
    """Levanta 429 se a chave está bloqueada agora. Chamar ANTES de conferir a
    senha, pra nem processar o login enquanto estiver bloqueado."""
    with SessionLocalAdmin() as db:
        linha = db.execute(
            text("SELECT bloqueado_ate FROM bloqueios_login WHERE chave = :c"), {"c": chave}
        ).first()
        if linha and linha[0] is not None:
            bloqueado_ate = linha[0]
            if bloqueado_ate.tzinfo is None:
                bloqueado_ate = bloqueado_ate.replace(tzinfo=timezone.utc)
            if bloqueado_ate > _agora():
                segundos = int((bloqueado_ate - _agora()).total_seconds())
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Muitas tentativas. Tente novamente em {max(1, segundos // 60)} min.",
                    headers={"Retry-After": str(segundos)},
                )


def registrar_falha(chave: str) -> None:
    """Conta uma falha de login. Se estourar o limite dentro da janela, marca
    a chave como bloqueada por BLOQUEIO_MIN. Transação própria, commit imediato."""
    agora = _agora()
    janela_inicio_min = agora - timedelta(minutes=JANELA_MIN)
    bloqueado_ate = agora + timedelta(minutes=BLOQUEIO_MIN)
    with SessionLocalAdmin() as db:
        # Upsert: se não existe ou a janela expirou, começa de 1; senão soma.
        db.execute(
            text("""
                INSERT INTO bloqueios_login (chave, tentativas, janela_inicio, bloqueado_ate)
                VALUES (:c, 1, :agora, NULL)
                ON CONFLICT (chave) DO UPDATE SET
                    tentativas = CASE
                        WHEN bloqueios_login.janela_inicio < :janela_min THEN 1
                        ELSE bloqueios_login.tentativas + 1 END,
                    janela_inicio = CASE
                        WHEN bloqueios_login.janela_inicio < :janela_min THEN :agora
                        ELSE bloqueios_login.janela_inicio END,
                    bloqueado_ate = CASE
                        WHEN bloqueios_login.janela_inicio >= :janela_min
                             AND bloqueios_login.tentativas + 1 >= :maxt
                        THEN :bloqueado_ate ELSE NULL END
            """),
            {
                "c": chave, "agora": agora, "janela_min": janela_inicio_min,
                "maxt": MAX_TENTATIVAS, "bloqueado_ate": bloqueado_ate,
            },
        )
        db.commit()


def limpar(chave: str) -> None:
    """Login bem-sucedido -- zera o contador da chave."""
    with SessionLocalAdmin() as db:
        db.execute(text("DELETE FROM bloqueios_login WHERE chave = :c"), {"c": chave})
        db.commit()
