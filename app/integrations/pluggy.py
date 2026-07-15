"""
Cliente do Pluggy (Open Finance) -- conexão automática de contas bancárias.

Fluxo:
  1. auth (clientId/clientSecret) -> apiKey temporária (~2h), cacheada em memória.
  2. connect_token -> accessToken de curta duração que o FRONTEND usa pra abrir o
     widget Pluggy Connect (o cliente autoriza o banco lá).
  3. depois de autorizado, o widget devolve um `itemId`; o backend usa a apiKey
     pra puxar as contas (accounts) e transações (transactions) desse item.

Gated por PLUGGY_CLIENT_ID/SECRET: sem as chaves, `pluggy_ativo()` é False e as
rotas não expõem o recurso (mesma ideia do OCR/Sentry). Sandbox pra testar sem
custo (bancos de mentira); produção é paga.
"""

import time
from datetime import date

import httpx

from app.core.config import settings

_BASE = "https://api.pluggy.ai"
# apiKey do Pluggy dura ~2h; renovamos com folga (100 min).
_TTL_APIKEY_S = 100 * 60


def pluggy_ativo() -> bool:
    return bool(settings.PLUGGY_CLIENT_ID and settings.PLUGGY_CLIENT_SECRET)


class PluggyIndisponivel(Exception):
    """Pluggy não configurado ou erro de comunicação com a API."""


# Cache simples em memória do apiKey (processo serverless pode reaproveitar
# entre requests enquanto quente; se esfriar, reautentica -- barato).
_apikey_cache = {"valor": None, "expira": 0.0}


def _apikey() -> str:
    if not pluggy_ativo():
        raise PluggyIndisponivel("Pluggy não configurado (faltam as chaves).")
    agora = time.time()
    if _apikey_cache["valor"] and agora < _apikey_cache["expira"]:
        return _apikey_cache["valor"]
    try:
        r = httpx.post(
            f"{_BASE}/auth",
            json={"clientId": settings.PLUGGY_CLIENT_ID, "clientSecret": settings.PLUGGY_CLIENT_SECRET},
            timeout=30,
        )
        r.raise_for_status()
        ak = r.json()["apiKey"]
    except (httpx.HTTPError, KeyError) as e:
        raise PluggyIndisponivel(f"Falha ao autenticar no Pluggy: {e}") from e
    _apikey_cache["valor"] = ak
    _apikey_cache["expira"] = agora + _TTL_APIKEY_S
    return ak


def _get(path: str, params: dict | None = None) -> dict:
    try:
        r = httpx.get(f"{_BASE}{path}", params=params, headers={"X-API-KEY": _apikey()}, timeout=45)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        raise PluggyIndisponivel(f"Erro no Pluggy ({path}): {e}") from e


def criar_connect_token(cliente_id: str | None = None) -> str:
    """Token de curta duração pro widget Pluggy Connect (frontend). clientUserId
    amarra o item ao nosso cliente (útil pra reconciliar depois)."""
    corpo: dict = {}
    if cliente_id:
        corpo["clientUserId"] = str(cliente_id)
    try:
        r = httpx.post(f"{_BASE}/connect_token", json=corpo, headers={"X-API-KEY": _apikey()}, timeout=30)
        r.raise_for_status()
        return r.json()["accessToken"]
    except (httpx.HTTPError, KeyError) as e:
        raise PluggyIndisponivel(f"Falha ao criar connect token: {e}") from e


def obter_item(item_id: str) -> dict:
    """Status + conector (banco) de um item conectado."""
    return _get(f"/items/{item_id}")


def listar_contas(item_id: str) -> list[dict]:
    return _get("/accounts", {"itemId": item_id}).get("results", [])


def listar_transacoes(account_id: str, desde: date | None = None, pagina_tam: int = 500) -> list[dict]:
    """Transações de uma conta. `desde` limita a busca (ISO date)."""
    params: dict = {"accountId": account_id, "pageSize": pagina_tam}
    if desde:
        params["from"] = desde.isoformat()
    return _get("/transactions", params).get("results", [])
