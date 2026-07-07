"""
Parser de extrato/fatura em CSV -- formato esperado (documentado também na
tela de Importar Extrato do frontend):

    data;descricao;valor
    28/06/2026;Supermercado Extra;-486,20
    25/06/2026;Salario;6200,00

- Aceita separador `,` ou `;` (detectado automaticamente).
- Data no formato DD/MM/AAAA (padrão brasileiro).
- Valor aceita tanto `1234.56` quanto `1.234,56` (separador decimal BR),
  com sinal indicando entrada (positivo) ou saída (negativo).
- Nomes de coluna aceitos (case-insensitive, com ou sem acento):
  data/date, descricao/descrição/historico, valor/value.
"""

import csv
import io
import re

from dateutil import parser as dateparser

_ALIASES = {
    "data": {"data", "date"},
    "descricao": {"descricao", "descrição", "historico", "histórico", "description"},
    "valor": {"valor", "value", "amount"},
}


class CsvFormatoInvalido(Exception):
    pass


def _detectar_delimitador(primeira_linha: str) -> str:
    return ";" if primeira_linha.count(";") >= primeira_linha.count(",") else ","


def _mapear_colunas(cabecalho: list[str]) -> dict:
    normalizado = {c.strip().lower(): c for c in cabecalho}
    mapa = {}
    for campo, aliases in _ALIASES.items():
        encontrada = next((normalizado[a] for a in aliases if a in normalizado), None)
        if not encontrada:
            raise CsvFormatoInvalido(
                f"Coluna '{campo}' não encontrada. Colunas esperadas: data, descricao, valor."
            )
        mapa[campo] = encontrada
    return mapa


def _parsear_valor(bruto: str) -> float:
    texto = bruto.strip().replace("R$", "").strip()
    # "1.234,56" ou "5000,56" (BR, com ou sem separador de milhar) -> "1234.56";
    # "1234.56" (US) passa direto. \d+ (não \d{1,3}) pro grupo inicial --
    # senão "5000,00" (4 dígitos, sem separador de milhar) não batia o regex
    # e caía no float() direto, que quebra com vírgula decimal.
    if re.match(r"^-?\d+(\.\d{3})*,\d{2}$", texto):
        texto = texto.replace(".", "").replace(",", ".")
    return float(texto)


def parse_csv(conteudo: bytes) -> list[dict]:
    texto = conteudo.decode("utf-8-sig", errors="replace")
    primeira_linha = texto.splitlines()[0] if texto.splitlines() else ""
    delimitador = _detectar_delimitador(primeira_linha)

    leitor = csv.DictReader(io.StringIO(texto), delimiter=delimitador)
    if not leitor.fieldnames:
        raise CsvFormatoInvalido("Arquivo CSV vazio ou sem cabeçalho.")
    mapa = _mapear_colunas(leitor.fieldnames)

    transacoes = []
    for linha in leitor:
        if not linha.get(mapa["data"]):
            continue
        data = dateparser.parse(linha[mapa["data"]], dayfirst=True).date()
        valor_bruto = _parsear_valor(linha[mapa["valor"]])
        transacoes.append(
            {
                "data": data,
                "descricao": linha[mapa["descricao"]].strip() or "Sem descrição",
                "valor": abs(valor_bruto),
                "tipo": "entrada" if valor_bruto >= 0 else "saida",
            }
        )
    return transacoes
