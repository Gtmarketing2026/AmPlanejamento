"""
Integração com o Google Agenda (Calendar API v3) para espelhar os follow-ups
do CRM como eventos na agenda do profissional.

Fluxo OAuth 2.0 (Authorization Code):
  1. profissional clica em "Conectar Google" -> backend gera a URL de
     consentimento (`gerar_url_consentimento`) e o frontend redireciona.
  2. Google chama de volta o `GOOGLE_REDIRECT_URI` com um `code`.
  3. backend troca o `code` por tokens (`trocar_codigo_por_tokens`) e guarda o
     `refresh_token` na tabela `credenciais_google`.
  4. a cada uso, `obter_access_token_valido` renova o access_token quando
     expirado, usando o refresh_token guardado.

Sem SDK do Google: usamos só `requests` contra os endpoints REST/OAuth. A
sincronização é unidirecional — o banco é a fonte da verdade, o evento no
Google é reflexo (criado/excluído a partir daqui, nunca lido de volta).
"""

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import requests

from app.core.config import settings

_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
_CALENDAR_EVENTS = "https://www.googleapis.com/calendar/v3/calendars/{cal}/events"

# calendar.events: criar/excluir eventos; openid+email: identificar a conta.
_SCOPES = "openid email https://www.googleapis.com/auth/calendar.events"

_TIMEOUT = 20


def oauth_configurado() -> bool:
    """Há credenciais de OAuth no servidor? Sem isso, nada de Google funciona
    (a UI mostra 'integração não configurada' em vez de quebrar)."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI)


def gerar_url_consentimento(state: str) -> str:
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": _SCOPES,
        "access_type": "offline",  # queremos refresh_token
        "prompt": "consent",  # força devolver refresh_token mesmo em reautorização
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


def trocar_codigo_por_tokens(code: str) -> dict:
    """Troca o `code` da callback pelos tokens. Retorna dict com
    refresh_token, access_token, expira_em (datetime tz-aware) e email_google."""
    resp = requests.post(
        _TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    dados = resp.json()

    access_token = dados["access_token"]
    expira_em = datetime.now(timezone.utc) + timedelta(seconds=dados.get("expires_in", 3600))

    email = None
    try:
        u = requests.get(
            _USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=_TIMEOUT,
        )
        if u.ok:
            email = u.json().get("email")
    except requests.RequestException:
        pass

    return {
        "refresh_token": dados.get("refresh_token"),
        "access_token": access_token,
        "expira_em": expira_em,
        "email_google": email,
    }


def renovar_access_token(refresh_token: str) -> dict:
    """Usa o refresh_token pra obter um novo access_token. Retorna
    {access_token, expira_em}."""
    resp = requests.post(
        _TOKEN_URL,
        data={
            "refresh_token": refresh_token,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        },
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    dados = resp.json()
    return {
        "access_token": dados["access_token"],
        "expira_em": datetime.now(timezone.utc) + timedelta(seconds=dados.get("expires_in", 3600)),
    }


def criar_evento_dia_inteiro(
    access_token: str, calendar_id: str, titulo: str, descricao: str | None, dia
) -> str:
    """Cria um evento de dia inteiro (all-day) e retorna o id do evento.
    `dia` é um datetime.date."""
    fim = dia + timedelta(days=1)  # all-day: end é exclusivo
    corpo = {
        "summary": titulo,
        "description": descricao or "",
        "start": {"date": dia.isoformat()},
        "end": {"date": fim.isoformat()},
        "source": {"title": "Fluxo — CRM", "url": "https://fluxo-backend.vercel.app"},
    }
    resp = requests.post(
        _CALENDAR_EVENTS.format(cal=calendar_id),
        headers={"Authorization": f"Bearer {access_token}"},
        json=corpo,
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def excluir_evento(access_token: str, calendar_id: str, event_id: str) -> None:
    resp = requests.delete(
        f"{_CALENDAR_EVENTS.format(cal=calendar_id)}/{event_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=_TIMEOUT,
    )
    # 410 = já removido no Google; tratamos como sucesso idempotente.
    if resp.status_code not in (200, 204, 404, 410):
        resp.raise_for_status()
