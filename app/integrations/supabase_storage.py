"""
Upload de arquivos pro Supabase Storage (extratos/faturas do Plano Essencial).

Usa a Storage REST API do Supabase diretamente (sem SDK) com a
service_role key -- só o backend tem essa chave, nunca o frontend. Bucket
é privado (não público): os arquivos só são acessíveis via URL assinada
de curta duração, gerada sob demanda.
"""

import uuid

import requests

from app.core.config import settings

_BASE = f"{settings.SUPABASE_URL}/storage/v1"


def _headers(content_type: str | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def upload_arquivo(conteudo: bytes, nome_original: str, profissional_id: uuid.UUID) -> str:
    """Envia o arquivo pro bucket privado e retorna o caminho (arquivo_url)
    salvo em importacoes_extrato.arquivo_url. Caminho isolado por
    profissional pra nunca colidir entre tenants diferentes."""
    caminho = f"{profissional_id}/{uuid.uuid4()}-{nome_original}"
    resp = requests.post(
        f"{_BASE}/object/{settings.SUPABASE_STORAGE_BUCKET}/{caminho}",
        headers=_headers("application/octet-stream"),
        data=conteudo,
        timeout=30,
    )
    resp.raise_for_status()
    return caminho


def excluir_arquivo(caminho: str) -> None:
    resp = requests.delete(
        f"{_BASE}/object/{settings.SUPABASE_STORAGE_BUCKET}/{caminho}",
        headers=_headers(),
        timeout=30,
    )
    resp.raise_for_status()


def gerar_url_assinada(caminho: str, expira_em_segundos: int = 300) -> str:
    """URL temporária pra baixar/visualizar o arquivo original (ex: conferir
    o extrato enviado) -- bucket é privado, então não existe URL pública fixa."""
    resp = requests.post(
        f"{_BASE}/object/sign/{settings.SUPABASE_STORAGE_BUCKET}/{caminho}",
        headers=_headers("application/json"),
        json={"expiresIn": expira_em_segundos},
        timeout=30,
    )
    resp.raise_for_status()
    return f"{settings.SUPABASE_URL}/storage/v1{resp.json()['signedURL']}"
