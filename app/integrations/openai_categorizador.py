"""
Classificação automática de categoria/subcategoria das transações
importadas, usando a API da OpenAI (chat completions, JSON mode).

Uma chamada por importação (não uma por transação) -- manda a lista
inteira, pede de volta a classificação na mesma ordem. Se a chamada
falhar por qualquer motivo, a importação continua normalmente (as
transações ficam sem categoria, o profissional/cliente classifica
manualmente depois) -- nunca trava o fluxo de importar.
"""

import json

import requests

from app.core.config import settings

_URL = "https://api.openai.com/v1/chat/completions"
_MODELO = "gpt-4o-mini"


class ClassificacaoIndisponivel(Exception):
    pass


def _montar_prompt_categorias(categorias: list, subcategorias: list) -> str:
    por_categoria: dict[str, list[str]] = {}
    subcats_por_cat_id: dict = {}
    for s in subcategorias:
        subcats_por_cat_id.setdefault(str(s.categoria_id), []).append(s.nome)
    for c in categorias:
        por_categoria[c.nome] = subcats_por_cat_id.get(str(c.id), [])
    return json.dumps(por_categoria, ensure_ascii=False)


def classificar_transacoes(
    transacoes: list[dict], categorias: list, subcategorias: list
) -> list[dict]:
    """transacoes: [{"descricao": str, "tipo": "entrada"|"saida"}, ...]
    Retorna lista PARALELA (mesmo tamanho/ordem) de {"categoria": str|None, "subcategoria": str|None}
    (nomes, não IDs -- quem chama resolve o nome pro id correspondente)."""
    if not settings.OPENAI_API_KEY or not transacoes:
        return [{"categoria": None, "subcategoria": None} for _ in transacoes]

    taxonomia = _montar_prompt_categorias(categorias, subcategorias)
    lista_transacoes = [
        {"indice": i, "descricao": t["descricao"], "tipo": t["tipo"]} for i, t in enumerate(transacoes)
    ]

    prompt_sistema = (
        "Você classifica transações financeiras de um app de planejamento financeiro "
        "brasileiro (B2B2C — planejadores gerenciam clientes finais). Para cada transação, "
        "escolha a categoria e subcategoria mais adequada dentre as fornecidas -- use "
        "EXATAMENTE os nomes fornecidos, nunca invente uma nova categoria/subcategoria. "
        "Se nenhuma se encaixar bem, use a categoria 'Classificação neutra' com "
        "subcategoria 'Sem classificação'. Responda em JSON no formato "
        '{"classificacoes": [{"indice": 0, "categoria": "...", "subcategoria": "..."}]}.'
        f"\n\nCategorias e subcategorias disponíveis (categoria -> subcategorias): {taxonomia}"
    )

    try:
        resp = requests.post(
            _URL,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": _MODELO,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": json.dumps({"transacoes": lista_transacoes}, ensure_ascii=False)},
                ],
            },
            # Bem abaixo do maxDuration da função (60s): a classificação é
            # best-effort -- se a OpenAI demorar, cortamos e importamos sem
            # categoria (classificável depois), em vez de estourar o tempo
            # total e derrubar a importação inteira (504).
            timeout=18,
        )
        resp.raise_for_status()
        conteudo = resp.json()["choices"][0]["message"]["content"]
        classificacoes = json.loads(conteudo).get("classificacoes", [])
    except (requests.RequestException, KeyError, json.JSONDecodeError) as e:
        raise ClassificacaoIndisponivel(str(e)) from e

    resultado = [{"categoria": None, "subcategoria": None} for _ in transacoes]
    for c in classificacoes:
        indice = c.get("indice")
        if isinstance(indice, int) and 0 <= indice < len(resultado):
            resultado[indice] = {"categoria": c.get("categoria"), "subcategoria": c.get("subcategoria")}
    return resultado
