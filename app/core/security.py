from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha_texto: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha_texto, senha_hash)


def criar_access_token(sub: str, tipo: str = "profissional") -> str:
    """tipo distingue quem é o dono do token (profissional | cliente_final) --
    impede que um token de cliente final seja aceito numa rota de profissional
    e vice-versa, mesmo que ambos sejam UUIDs válidos assinados com a mesma chave."""
    expira_em = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": sub, "tipo": tipo, "exp": expira_em}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decodificar_access_token(token: str) -> str | None:
    """Retorna o profissional_id do token, ou None se inválido/expirado/de outro tipo."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("tipo", "profissional") != "profissional":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def decodificar_token_cliente(token: str) -> str | None:
    """Retorna o cliente_id do token, ou None se inválido/expirado/de outro tipo."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("tipo") != "cliente_final":
            return None
        return payload.get("sub")
    except JWTError:
        return None


def decodificar_token_admin(token: str) -> str | None:
    """Retorna o admin_id do token, ou None se inválido/expirado/de outro tipo.
    Nível "Negócio" — nunca aceitar aqui um token de profissional ou de
    cliente_final, mesmo que o sub seja um UUID válido assinado com a mesma
    chave (ver app/api/deps.py::get_db_negocio)."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("tipo") != "admin":
            return None
        return payload.get("sub")
    except JWTError:
        return None
