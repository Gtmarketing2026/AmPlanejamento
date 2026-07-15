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
from datetime import date, datetime

import requests

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
        r = requests.post(
            f"{_BASE}/auth",
            json={"clientId": settings.PLUGGY_CLIENT_ID, "clientSecret": settings.PLUGGY_CLIENT_SECRET},
            timeout=30,
        )
        r.raise_for_status()
        ak = r.json()["apiKey"]
    except (requests.RequestException, KeyError) as e:
        raise PluggyIndisponivel(f"Falha ao autenticar no Pluggy: {e}") from e
    _apikey_cache["valor"] = ak
    _apikey_cache["expira"] = agora + _TTL_APIKEY_S
    return ak


def _get(path: str, params: dict | None = None) -> dict:
    try:
        r = requests.get(f"{_BASE}{path}", params=params, headers={"X-API-KEY": _apikey()}, timeout=45)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        raise PluggyIndisponivel(f"Erro no Pluggy ({path}): {e}") from e


def criar_connect_token(cliente_id: str | None = None) -> str:
    """Token de curta duração pro widget Pluggy Connect (frontend). clientUserId
    amarra o item ao nosso cliente (útil pra reconciliar depois)."""
    corpo: dict = {}
    if cliente_id:
        corpo["clientUserId"] = str(cliente_id)
    try:
        r = requests.post(f"{_BASE}/connect_token", json=corpo, headers={"X-API-KEY": _apikey()}, timeout=30)
        r.raise_for_status()
        return r.json()["accessToken"]
    except (requests.RequestException, KeyError) as e:
        raise PluggyIndisponivel(f"Falha ao criar connect token: {e}") from e


def obter_item(item_id: str) -> dict:
    """Status + conector (banco) de um item conectado."""
    return _get(f"/items/{item_id}")


# Status "em andamento" do Pluggy -- enquanto o item estiver num desses, ainda
# está sincronizando e as transações podem não ter chegado.
_EM_ANDAMENTO = {"UPDATING", "CREATING", "LOGIN_IN_PROGRESS", "WAITING_USER_ACTION"}


def esperar_item(item_id: str, tentativas: int = 15, intervalo_s: float = 2.5) -> dict:
    """Aguarda o item sair do estado 'em andamento' (vira UPDATED, erro, etc.)
    antes de puxar as transações -- o widget às vezes retorna antes de os dados
    ficarem prontos. Trava por tempo (Vercel maxDuration): ~37s."""
    item = obter_item(item_id)
    for _ in range(tentativas):
        if item.get("status") not in _EM_ANDAMENTO:
            break
        time.sleep(intervalo_s)
        item = obter_item(item_id)
    return item


def listar_contas(item_id: str) -> list[dict]:
    return _get("/accounts", {"itemId": item_id}).get("results", [])


def _data_tx(tx: dict) -> date | None:
    bruto = tx.get("date")
    try:
        return datetime.fromisoformat(bruto.replace("Z", "+00:00")).date() if bruto else None
    except (ValueError, AttributeError):
        return None


def listar_transacoes(account_id: str, desde: date | None = None, max_paginas: int = 40) -> list[dict]:
    """Transações de uma conta via /v2/transactions (paginação por CURSOR -- o
    endpoint /transactions v1 foi deprecado). v2 não aceita 'from'/'pageSize',
    então o filtro `desde` é aplicado no cliente. `max_paginas` é trava de
    segurança contra loop infinito."""
    todas: list[dict] = []
    cursor: str | None = None
    for _ in range(max_paginas):
        params: dict = {"accountId": account_id}
        if cursor:
            params["cursor"] = cursor
        d = _get("/v2/transactions", params)
        todas.extend(d.get("results", []))
        cursor = d.get("next")
        if not cursor:
            break
    if desde:
        todas = [t for t in todas if (dt := _data_tx(t)) and dt >= desde]
    return todas


def mapear_transacao(tx: dict) -> dict | None:
    """Converte uma transação do Pluggy (v2) pro formato interno do pipeline
    ({data, descricao, valor, tipo}). v2 traz `type` (CREDIT/DEBIT) e `amount`
    COM SINAL (negativo = saída). Usa o type; cai pro sinal se faltar. Valor
    sempre positivo. Devolve None se faltar data/valor/descrição."""
    data = _data_tx(tx)
    valor = tx.get("amount")
    desc = (tx.get("description") or tx.get("descriptionRaw") or "").strip()
    if data is None or valor is None or not desc:
        return None
    t = str(tx.get("type") or "").upper()
    if t == "CREDIT":
        tipo = "entrada"
    elif t == "DEBIT":
        tipo = "saida"
    else:
        tipo = "entrada" if float(valor) >= 0 else "saida"
    return {"data": data, "descricao": desc, "valor": abs(float(valor)), "tipo": tipo}
