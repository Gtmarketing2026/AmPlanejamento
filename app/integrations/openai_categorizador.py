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


def extrair_transacoes_ocr(texto_ocr: str, tipo_documento: str) -> list[dict]:
    """Extrai lançamentos de um texto de OCR (fatura/extrato cujo PDF é ilegível
    por extração de texto). A IA entende o contexto e remonta as transações
    mesmo com o texto desalinhado/em colunas -- muito mais robusto que regex.
    Retorna [{"data": date, "descricao": str, "valor": float(abs), "tipo":
    "entrada"|"saida"}]. Best-effort: [] se a OpenAI falhar ou não achar nada."""
    from datetime import date as _date

    if not settings.OPENAI_API_KEY or not (texto_ocr or "").strip():
        return []

    eh_fatura = tipo_documento == "fatura_cartao"
    prompt_sistema = (
        "Você extrai lançamentos de uma "
        + ("fatura de cartão de crédito" if eh_fatura else "extrato bancário")
        + " a partir de um texto de OCR (pode vir desalinhado ou em colunas). "
        "Extraia APENAS as compras/movimentações que efetivamente entraram NESTE "
        "documento (a lista de lançamentos do período), com data, descrição do "
        "estabelecimento e valor. Inclua compras parceladas COM o marcador "
        "'Parcela X de Y' exatamente como aparece na lista.\n"
        "NÃO EXTRAIA (isto é o que mais causa erro): \n"
        "- a seção de PARCELAS FUTURAS / 'próximas faturas' / 'compras parceladas "
        "nos próximos meses' / 'parcelas a vencer' / 'próximas parcelas' -- ou seja, "
        "NÃO invente parcelas de meses futuros que ainda não caíram neste documento;\n"
        "- pagamento da fatura (ex: 'Pagamento da fatura de janeiro', 'Pagamento "
        "recebido'), saldo, limite, 'total a pagar', totais, subtotais, resumos;\n"
        "- juros/IOF/CET/multas/parcelamento apresentados como INFORMATIVO de taxas "
        "(mas uma TARIFA/ANUIDADE cobrada na lista de lançamentos, sim, é despesa);\n"
        "- cabeçalhos e textos explicativos.\n"
        "Na dúvida se um número é uma compra real ou um total/projeção, NÃO inclua. "
        + (
            "Em fatura de cartão, cada compra é uma SAÍDA; estornos/créditos/"
            "devoluções são ENTRADA. "
            if eh_fatura
            else "Entradas de dinheiro = 'entrada'; saídas/débitos = 'saida'. "
        )
        + "Datas no formato AAAA-MM-DD (use o ano da fatura/extrato; se só houver "
        "dia/mês, infira o ano pelo período do documento). Valores positivos com "
        "ponto decimal. Responda em JSON: "
        '{"transacoes":[{"data":"AAAA-MM-DD","descricao":"...","valor":12.34,"tipo":"saida"}]}'
    )
    try:
        resp = requests.post(
            _URL,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": prompt_sistema},
                    {"role": "user", "content": (texto_ocr or "")[:14000]},
                ],
            },
            timeout=40,
        )
        resp.raise_for_status()
        bruto = json.loads(resp.json()["choices"][0]["message"]["content"]).get("transacoes", [])
    except (requests.RequestException, KeyError, json.JSONDecodeError, ValueError):
        return []

    resultado = []
    for t in bruto:
        try:
            data = _date.fromisoformat(str(t.get("data")))
            valor = abs(float(t.get("valor")))
        except (TypeError, ValueError):
            continue
        if valor <= 0:
            continue
        tipo = "entrada" if str(t.get("tipo")).lower().startswith("entr") else "saida"
        desc = (t.get("descricao") or "Sem descrição").strip()[:200]
        resultado.append({"data": data, "descricao": desc, "valor": valor, "tipo": tipo})
    return resultado


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
        "Você é uma IA classificadora de lançamentos financeiros de um app brasileiro "
        "(B2B2C — planejadores gerenciam clientes finais). Para cada transação, escolha a "
        "categoria e subcategoria mais adequada dentre as fornecidas -- use EXATAMENTE os "
        "nomes fornecidos, NUNCA invente categoria/subcategoria. Se nada se encaixar, use "
        "'Classificação neutra' / 'Sem classificação'.\n"
        "\nNormalize a descrição: ignore códigos, NSU, IDs de transação, autenticações e "
        "números sem sentido; entenda 'PADARIA X', 'PIX PADARIA X' e 'COMPRA PADARIA X' como "
        "o mesmo gasto.\n"
        "\nRegras de palavra-chave (memória do sistema):\n"
        "- Juros, IOF, multa, encargo, mora, imposto, tributo, DAS, DARF, MEI, Simples "
        "Nacional, IPTU, IPVA, licenciamento -> Despesas obrigatórias / Impostos e taxas.\n"
        "- Tarifa bancária, cesta bancária, manutenção de conta, anuidade, tarifa PIX/TED/DOC, "
        "taxa de saque -> Despesas não obrigatórias / Tarifas bancárias.\n"
        "- Empréstimo, consignado, crédito pessoal, renegociação, CDC -> Dívidas / Dívidas e empréstimos.\n"
        "- Financiamento de imóvel/habitação -> Financiamentos / Financiamento imobiliário; "
        "financiamento de carro/moto/veículo -> Financiamentos / Financiamento veículo.\n"
        "- Supermercado, mercearia, hortifruti, açougue, padaria, atacadão, Assaí, Carrefour, "
        "Guanabara, Prezunic -> Despesas obrigatórias / Mercado.\n"
        "- Restaurante, bar, lanchonete, pizzaria, cafeteria, iFood, aiqfome, delivery -> "
        "Despesas não obrigatórias / Restaurantes.\n"
        "- Uber, 99, táxi, ônibus, metrô, combustível, posto, Shell, Ipiranga, estacionamento, "
        "pedágio, Sem Parar -> Despesas obrigatórias / Transporte.\n"
        "- Aluguel, condomínio, água, luz, energia, gás, internet residencial, Enel, Light, "
        "Cemig, Sabesp -> Despesas obrigatórias / Casa.\n"
        "- Farmácia, drogaria, remédio, plano de saúde, Unimed, hospital, clínica, laboratório, "
        "dentista, consulta, exame -> Despesas obrigatórias / Saúde (ou Despesas médicas se for "
        "claramente consulta/exame/procedimento).\n"
        "- Escola, faculdade, curso, mensalidade, material escolar -> Despesas obrigatórias / Educação.\n"
        "- Pet shop, veterinário, ração, banho e tosa -> Despesas obrigatórias / Pets.\n"
        "- Seguro auto/vida/residencial -> Despesas obrigatórias / Seguros.\n"
        "- Cabeleireiro, salão, manicure, barbearia, estética -> Despesas obrigatórias / Cuidados pessoais.\n"
        "- Netflix, Spotify, Disney, HBO, cinema, show, ingresso, games -> Despesas não obrigatórias / Lazer.\n"
        "- Amazon Prime, iCloud, Google One, apps pessoais recorrentes -> Despesas não obrigatórias / Assinaturas e serviços.\n"
        "- Shopee, Amazon (compra), Mercado Livre, Magalu, Americanas, AliExpress, shopping -> "
        "Despesas não obrigatórias / Compras.\n"
        "- Renner, C&A, Riachuelo, Shein, roupas, calçados -> Despesas não obrigatórias / Roupas e acessórios.\n"
        "- Hotel, pousada, Airbnb, passagem aérea, Latam, Gol, Azul, hospedagem -> Despesas não obrigatórias / Viagens.\n"
        "- Presente, doação, dízimo, igreja, vaquinha -> Despesas não obrigatórias / Presentes e doações.\n"
        "- Academia, crossfit, pilates, natação -> Despesas não obrigatórias / Esportes.\n"
        "\nRegras de empresa (PJ): Meta/Facebook/Google/TikTok Ads, tráfego pago, Canva, RD "
        "Station -> Empresa e autônomo / Marketing. Notion, Trello, Slack, N8N, Google Workspace, "
        "CRM, software de trabalho -> Empresa e autônomo / Ferramentas. Stone, Cielo, Getnet, "
        "PagSeguro, Mercado Pago (venda/taxa/maquininha), SumUp, InfinitePay, taxa de cartão -> "
        "Empresa e autônomo / Meios de pagamento. Imposto empresarial/DAS/contador/CNPJ -> "
        "Empresa e autônomo / Taxas e impostos. Funcionário, pró-labore, comissão -> Empresa e "
        "autônomo / Colaboradores. Fornecedor, prestador, mão de obra -> Empresa e autônomo / "
        "Prestadores de serviço. Insumos, matéria-prima, embalagem, estoque -> Empresa e autônomo "
        "/ Insumos e outros. Aluguel/energia/estrutura da empresa -> Empresa e autônomo / Infraestrutura.\n"
        "\nCasos ambíguos: 'Mercado Pago' NÃO é Mercado (é Meios de pagamento). Amazon: Prime -> "
        "Assinaturas; compra comum -> Compras. Google: Ads -> Marketing; Workspace -> Ferramentas.\n"
        "\nTRANSFERÊNCIAS de extrato (Pix/TED/DOC): o que importa é o FAVORECIDO, não o banco dele. "
        "Nomes de instituição de pagamento (PagSeguro, Mercado Pago, Nu Pagamentos, PagBank, Adyen, "
        "Cielo etc.) numa transferência são só o BANCO de destino da pessoa -- NÃO classifique como "
        "'Meios de pagamento' por isso.\n"
        "REGRA CRÍTICA: NUNCA deduza uma categoria de gasto a partir do NOME de uma pessoa física. "
        "'Pix - JOÃO DA SILVA' ou 'Pix - Maria Souza' NÃO é Educação, nem Restaurante, nem Mercado, "
        "nem Colaboradores -- não há como saber o motivo. Sem um ESTABELECIMENTO ou ATIVIDADE explícita "
        "na descrição (ex: 'FARMÁCIA', 'DETRAN', 'ESCOLA', 'MERCADO', 'HOTMART'), transferência pra "
        "pessoa é SEMPRE 'Classificação neutra' / 'Sem classificação'. Só classifique pela atividade "
        "quando o favorecido for claramente um comércio/serviço/órgão reconhecível.\n"
        "\nResponda em JSON: "
        '{"classificacoes": [{"indice": 0, "categoria": "...", "subcategoria": "..."}]}.'
        f"\n\nCategorias e subcategorias disponíveis (use SÓ estas; categoria -> subcategorias): {taxonomia}"
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
            # Chamado em LOTES pequenos (ver aplicar_classificacao_ia): cada
            # lote responde em poucos segundos, então um timeout curto (15s) é
            # suficiente e mantém o total dentro do maxDuration=60s da função.
            # Best-effort: se um lote estoura, os outros ainda classificam.
            timeout=15,
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
