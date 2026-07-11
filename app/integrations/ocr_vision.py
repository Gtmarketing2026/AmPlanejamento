"""
OCR de PDF via Google Cloud Vision (files:annotate), usado só como FALLBACK
quando a extração de texto do PDF falha (fonte com ToUnicode quebrado -- o texto
não é recuperável de nenhum jeito por bibliotecas de texto; ver
app/api/routes/importacoes.py::_descricao_ilegivel). O Vision "enxerga" a página
renderizada e transcreve, como um scanner.

Auth por API key (não precisa service account): habilitar a "Cloud Vision API"
no Google Cloud e criar uma API key; setar GOOGLE_VISION_API_KEY nas env vars.
Melhor esforço: se não estiver configurado ou falhar, levanta OcrIndisponivel e o
caller trata (recusa a importação com mensagem clara).
"""

import base64

import requests

from app.core.config import settings

_URL = "https://vision.googleapis.com/v1/files:annotate"
# files:annotate síncrono processa até 5 páginas por request -- suficiente pra
# quase toda fatura/extrato; páginas além disso (geralmente rodapé legal) ficam
# de fora.
_MAX_PAGINAS = 5


class OcrIndisponivel(Exception):
    pass


def ocr_disponivel() -> bool:
    return bool(settings.GOOGLE_VISION_API_KEY)


def ocr_pdf(conteudo: bytes) -> str:
    """Retorna o texto transcrito do PDF (todas as páginas, na ordem). Levanta
    OcrIndisponivel se não configurado ou se a chamada falhar."""
    if not settings.GOOGLE_VISION_API_KEY:
        raise OcrIndisponivel("OCR não configurado (GOOGLE_VISION_API_KEY vazio)")

    corpo = {
        "requests": [
            {
                "inputConfig": {
                    "content": base64.b64encode(conteudo).decode("ascii"),
                    "mimeType": "application/pdf",
                },
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                "pages": list(range(1, _MAX_PAGINAS + 1)),
            }
        ]
    }
    try:
        resp = requests.post(
            f"{_URL}?key={settings.GOOGLE_VISION_API_KEY}",
            json=corpo,
            timeout=40,
        )
        resp.raise_for_status()
        dados = resp.json()
    except requests.RequestException as e:
        raise OcrIndisponivel(f"Falha na chamada de OCR: {e}") from e

    # Estrutura: responses[0].responses[] (uma entrada por página).
    try:
        paginas = dados["responses"][0].get("responses", [])
    except (KeyError, IndexError):
        raise OcrIndisponivel("Resposta de OCR inesperada")

    partes = []
    for pag in paginas:
        if "error" in pag:
            continue
        texto = (pag.get("fullTextAnnotation") or {}).get("text")
        if texto:
            partes.append(texto)
    if not partes:
        raise OcrIndisponivel("OCR não retornou texto")
    return "\n".join(partes)
