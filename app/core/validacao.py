"""Validações de segurança reutilizadas nas rotas (política de senha etc.)."""

from fastapi import HTTPException, status

SENHA_MIN = 8


def validar_senha_forte(senha: str) -> None:
    """Política mínima de senha: pelo menos 8 caracteres, com ao menos uma
    letra e um número. Levanta 422 se não cumprir. Baseline simples e eficaz
    contra senhas triviais ("1234", "senha") — sem exigir símbolos (que só
    incentivam senhas anotadas)."""
    s = senha or ""
    if len(s) < SENHA_MIN:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"A senha precisa ter pelo menos {SENHA_MIN} caracteres.",
        )
    if not any(c.isalpha() for c in s) or not any(c.isdigit() for c in s):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A senha precisa ter pelo menos uma letra e um número.",
        )
