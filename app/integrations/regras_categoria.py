"""
Classificação por REGRAS de palavra-chave (determinística, instantânea, sem IA).

Baseada na "memória inicial" definida pelo produto: mapeia descrições de
lançamentos direto pra (categoria, subcategoria) do sistema. Cobre a maior
parte de uma fatura/extrato (comércios e cobranças recorrentes) na hora do
upload, deixando pra IA só o que é ambíguo/novo.

Ordem = prioridade: exceções e regras de negócio (Empresa) vêm antes das
genéricas. A primeira regra que casar vence. Nomes de categoria/subcategoria
DEVEM bater exatamente com os do sistema (ver seed de categorias).

Mantido conservador de propósito: só palavras-chave de alta confiança. Termos
ambíguos (Amazon, Google puro, PIX pra PF, "Mercado Pago" x "Mercado") são
deixados pra IA decidir, exceto as exceções explícitas abaixo.
"""

import re

# (categoria, subcategoria, padrão regex)
_DEFINICOES = [
    # --- Movimentações neutras (auto-transferência / pagamento de fatura) ---
    # Alta confiança e comum a todos os bancos: "Pagamento de fatura" (Nubank),
    # "Pgto fatura cartão", "Pagamento fatura" -> não é despesa nova, é quitação
    # do cartão (a despesa real já está nos lançamentos da fatura).
    ("Classificação neutra", "Pagamento fatura de cartão",
     r"pagamento\s+(de\s+)?fatura|pgto\.?\s+fatura|pagamento\s+cart[ãa]o\s+de\s+cr[eé]dito"),
    # --- Meios de pagamento / adquirentes (antes de "mercado" p/ "Mercado Pago") ---
    # Só como MAQUININHA/adquirente (venda) -- em transferências de extrato esses
    # nomes são o banco de destino e já foram removidos por _limpar_transferencia.
    ("Empresa e autônomo", "Meios de pagamento",
     r"mercado\s*pago|\bstone\b|\bcielo\b|getnet|pagseguro|pagbank|\bsumup\b|infinitepay|maquininh|antecipa[çc][ãa]o de receb[ií]"),
    # --- Marketing / anúncios ---
    ("Empresa e autônomo", "Marketing",
     r"\b(meta|facebook|instagram|google|tiktok|fb)\s*ads\b|tr[aá]fego pago|impulsionament|\brd station\b|\bcanva\b|\bcapcut\b|social ?media"),
    # --- Ferramentas de trabalho (software) ---
    ("Empresa e autônomo", "Ferramentas",
     r"google workspace|\bnotion\b|\btrello\b|\bslack\b|\bn8n\b|\bhubspot\b|\bfigma\b|\bzapier\b|\bg\s*suite\b"),
    # --- Impostos e taxas (tributos, juros, encargos) ---
    ("Despesas obrigatórias", "Impostos e taxas",
     r"\bjuros\b|\biof\b|\bmulta\b|encargo|\bmora\b|\bimposto|\btributo|\bdas\b|\bdarf\b|simples nacional|\biptu\b|\bipva\b|licenciament|\bdetran\b|receita federal|\bsefaz\b|prefeitura|\bfgts\b|\bgru\b|\bsimples\b"),
    # --- Tarifas bancárias ---
    ("Despesas não obrigatórias", "Tarifas bancárias",
     r"\btarifa|cesta banc[aá]ri|manuten[çc][ãa]o de conta|\banuidade\b|taxa de saque"),
    # --- Financiamentos (antes de Dívidas) ---
    ("Financiamentos", "Financiamento imobiliário",
     r"financ\w*\s*imobil|cr[eé]dito imobil|parcela habitac|caixa habita"),
    ("Financiamentos", "Financiamento veículo",
     r"financ\w*\s*ve[ií]culo|financ\w*\s*auto\b|cr[eé]dito ve[ií]culo"),
    # --- Dívidas / empréstimos ---
    ("Dívidas", "Dívidas e empréstimos",
     r"empr[eé]stimo|consignado|cr[eé]dito pessoal|renegocia[çc]|\bcdc\b"),
    # --- Mercado (exceção "mercado livre" -> Compras, resolvida logo abaixo) ---
    ("Despesas não obrigatórias", "Compras",
     r"mercado\s*livre|mercadolivre"),
    ("Despesas obrigatórias", "Mercado",
     r"supermercado|hipermercado|mercadinho|mercearia|hortifruti|sacol[ãa]o|a[çc]ougue|padaria|atacad[ãa]o|\bassa[ií]\b|carrefour|guanabara|prezunic|\bmercado\b"),
    # --- Restaurantes / delivery ---
    ("Despesas não obrigatórias", "Restaurantes",
     r"restaurante|\bbar\b|lanchonete|hamburgueria|pizzaria|cafeteria|\bifood\b|aiqfome|\bdelivery\b|mcdonald|burger king|subway|\bhabib|spoleto|outback|\bpub\b"),
    # --- Transporte ---
    ("Despesas obrigatórias", "Transporte",
     r"\buber\b|99app|99\s*pop|\bt[aá]xi\b|[ôo]nibus|\bmetr[ôo]\b|combust[ií]vel|gasolina|\bposto\b|\bshell\b|ipiranga|petrobras|estacionament|ped[aá]gio|sem parar|conectcar|\bveloe\b|abastecim"),
    # --- Casa (moradia e contas) ---
    ("Despesas obrigatórias", "Casa",
     r"aluguel|condom[ií]nio|internet residencial|\benel\b|\blight\b|\bcemig\b|\bcpfl\b|\bcopel\b|sabesp|\bcedae\b|comg[aá]s|\benergia el[eé]tric|conta de (luz|[aá]gua|g[aá]s)"),
    # --- Saúde ---
    ("Despesas obrigatórias", "Saúde",
     r"farm[aá]cia|drogaria|drogasil|droga\s*raia|\bpacheco\b|pague menos|rem[eé]dio|medicament|plano de sa[uú]de|\bunimed\b|\bamil\b|hapvida|\bhospital\b|cl[ií]nica|laborat[oó]rio|dentista|odonto"),
    # --- Educação ---
    ("Despesas obrigatórias", "Educação",
     r"\bescola\b|faculdade|universidade|\bcurso\b|mensalidade|material escolar|\budemy\b|\balura\b"),
    # --- Pets ---
    ("Despesas obrigatórias", "Pets",
     r"pet\s*shop|petshop|\bpetz\b|cobasi|veterin[aá]ri|\bra[çc][ãa]o\b|banho e tosa"),
    # --- Seguros ---
    ("Despesas obrigatórias", "Seguros",
     r"seguro (auto|de vida|residenc|empres|viagem)|prote[çc][ãa]o veicular|porto seguro"),
    # --- Cuidados pessoais ---
    ("Despesas obrigatórias", "Cuidados pessoais",
     r"cabeleireiro|sal[ãa]o de beleza|manicure|barbearia|\best[eé]tica\b|depila[çc]"),
    # --- Lazer (streaming e entretenimento) ---
    ("Despesas não obrigatórias", "Lazer",
     r"netflix|spotify|disney\+?|disney plus|prime video|hbo\s*max|globoplay|deezer|youtube premium|cinema|cinemark|\bkinoplex\b|ingresso|\bsteam\b|playstation|\bxbox\b|nintendo"),
    # --- Assinaturas e serviços (pessoais) ---
    ("Despesas não obrigatórias", "Assinaturas e serviços",
     r"amazon prime|\bicloud\b|google one|\bdropbox\b|apple\.com/bill"),
    # --- Compras (marketplaces / lojas gerais) ---
    ("Despesas não obrigatórias", "Compras",
     r"\bshopee\b|magalu|magazine luiza|americanas|casas bahia|aliexpress|\bamazon\b"),
    # --- Roupas e acessórios ---
    ("Despesas não obrigatórias", "Roupas e acessórios",
     r"\brenner\b|riachuelo|\bc&a\b|\bshein\b|\bzara\b|\bhering\b|\bmarisa\b|\bpernambucanas\b"),
    # --- Viagens ---
    ("Despesas não obrigatórias", "Viagens",
     r"\bhotel\b|pousada|airbnb|passagem a[eé]rea|\blatam\b|decolar|\bbooking\b|hospedagem|\bcvc\b|hot[eé]is"),
    # --- Presentes e doações ---
    ("Despesas não obrigatórias", "Presentes e doações",
     r"doa[çc][ãa]o|d[ií]zimo|oferta.*igreja|vaquinha"),
    # --- Esportes ---
    ("Despesas não obrigatórias", "Esportes",
     r"academia|smart\s*fit|bio\s*ritmo|crossfit|pilates|nata[çc][ãa]o"),
]

REGRAS = [(re.compile(p, re.IGNORECASE), cat, sub) for (cat, sub, p) in _DEFINICOES]


def classificar_por_regra(descricao: str) -> tuple[str, str] | None:
    """Retorna (categoria, subcategoria) da 1ª regra que casar, ou None."""
    d = descricao or ""
    for rx, cat, sub in REGRAS:
        if rx.search(d):
            return cat, sub
    return None
