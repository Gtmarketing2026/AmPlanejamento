"""
Parser de extrato/fatura em PDF -- o mais frágil dos três, porque cada banco
formata o PDF de um jeito (e não existe padrão como o OFX). Esforço
"melhor possível": funciona bem com PDFs gerados digitalmente pelo banco
(texto selecionável); NÃO faz OCR, então PDF de imagem escaneada não
funciona (fica com 0 transações e a tela mostra isso, não finge sucesso).

Estratégia:
  1. Tenta extrair tabelas (pdfplumber) -- funciona quando o banco usa
     layout tabular de verdade.
  2. Se não achar tabela, cai pra varredura de texto linha a linha com
     regex (data + valor na mesma linha).
"""

import io
import re
from datetime import date, datetime

import pdfplumber
from dateutil import parser as dateparser

_PADRAO_DATA = re.compile(r"(\d{2}/\d{2}(?:/\d{2,4})?)")
_PADRAO_VALOR = re.compile(r"(-?R?\$?\s?-?\d{1,3}(?:\.\d{3})*,\d{2})")


def _parsear_data(bruto: str, ano_referencia: int) -> date | None:
    try:
        d = dateparser.parse(bruto, dayfirst=True, default=datetime(ano_referencia, 1, 1))
        return d.date()
    except (ValueError, OverflowError):
        return None


def _parsear_valor(bruto: str) -> float | None:
    texto = bruto.replace("R$", "").replace(" ", "").strip()
    texto = texto.replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except ValueError:
        return None


def _extrair_de_tabelas(pdf: "pdfplumber.PDF", ano_referencia: int) -> list[dict]:
    transacoes = []
    for pagina in pdf.pages:
        for tabela in pagina.extract_tables() or []:
            for linha in tabela:
                celulas = [c for c in (linha or []) if c]
                if len(celulas) < 2:
                    continue
                data_match = next((c for c in celulas if _PADRAO_DATA.fullmatch(c.strip())), None)
                valor_match = next((c for c in celulas if _PADRAO_VALOR.fullmatch(c.strip())), None)
                if not data_match or not valor_match:
                    continue
                data = _parsear_data(data_match, ano_referencia)
                valor = _parsear_valor(valor_match)
                if data is None or valor is None:
                    continue
                descricao = next(
                    (c for c in celulas if c not in (data_match, valor_match)), "Sem descrição"
                )
                transacoes.append(
                    {
                        "data": data,
                        "descricao": descricao.strip(),
                        "valor": abs(valor),
                        "tipo": "entrada" if valor >= 0 else "saida",
                    }
                )
    return transacoes


def _extrair_de_texto(pdf: "pdfplumber.PDF", ano_referencia: int) -> list[dict]:
    transacoes = []
    for pagina in pdf.pages:
        texto = pagina.extract_text() or ""
        for linha in texto.splitlines():
            data_match = _PADRAO_DATA.search(linha)
            valor_match = _PADRAO_VALOR.search(linha)
            if not data_match or not valor_match:
                continue
            data = _parsear_data(data_match.group(1), ano_referencia)
            valor = _parsear_valor(valor_match.group(1))
            if data is None or valor is None:
                continue
            descricao = linha.replace(data_match.group(0), "").replace(valor_match.group(0), "").strip()
            transacoes.append(
                {
                    "data": data,
                    "descricao": descricao or "Sem descrição",
                    "valor": abs(valor),
                    "tipo": "entrada" if valor >= 0 else "saida",
                }
            )
    return transacoes


def parse_pdf(conteudo: bytes, ano_referencia: int | None = None) -> list[dict]:
    ano_referencia = ano_referencia or date.today().year
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        transacoes = _extrair_de_tabelas(pdf, ano_referencia)
        if not transacoes:
            transacoes = _extrair_de_texto(pdf, ano_referencia)
    return transacoes
