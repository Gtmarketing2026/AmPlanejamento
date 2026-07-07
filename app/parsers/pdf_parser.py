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
     regex (data + valor na mesma linha), restrita à seção de transações
     quando o documento tiver uma (cabeçalho "Data ... Valor" até a linha
     de "Total ..."), pra não confundir linhas de boleto/resumo (que também
     têm data + valor na mesma linha, mas não são lançamentos) com
     transações de verdade. Sem esse cabeçalho reconhecível, cai pro
     comportamento antigo de varrer o documento inteiro.

Muitas faturas de cartão brasileiras são exportadas com senha (geralmente
dígitos do CPF/nascimento do titular) -- por isso `parse_pdf` aceita uma
senha opcional e sinaliza `PdfProtegido` de forma distinta de um PDF
simplesmente malformado, pra a rota pedir a senha em vez de só dizer "erro".
"""

import io
import re
from datetime import date, datetime

import pdfplumber
from dateutil import parser as dateparser
from pdfminer.pdfdocument import PDFPasswordIncorrect
from pdfplumber.utils.exceptions import PdfminerException

_PADRAO_DATA = re.compile(r"(\d{2}/\d{2}(?:/\d{2,4})?)")
_PADRAO_VALOR = re.compile(r"(-?R?\$?\s?-?\d{1,3}(?:\.\d{3})*,\d{2})")

# Cabeçalho de uma tabela de transações ("Data Descrição Valor" ou variações)
# -- usado pra restringir a varredura de texto à seção certa do documento.
_PADRAO_CABECALHO_TRANSACOES = re.compile(r"\bdata\b.{0,40}\bvalor\b", re.IGNORECASE)
# Linha que fecha a seção de transações (ex: "Total a pagar do cartão R$ ...").
_PADRAO_FIM_SECAO = re.compile(r"^\s*total\b", re.IGNORECASE)


class PdfProtegido(Exception):
    """PDF criptografado por senha -- distinto de um PDF só malformado, pra
    a rota poder pedir a senha em vez de só marcar "erro" genérico."""


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
    linhas = []
    for pagina in pdf.pages:
        texto = pagina.extract_text() or ""
        linhas.extend(texto.splitlines())

    tem_secao_marcada = any(_PADRAO_CABECALHO_TRANSACOES.search(linha) for linha in linhas)

    transacoes = []
    # Sem cabeçalho reconhecível, mantém o comportamento antigo (varre tudo).
    dentro_secao = not tem_secao_marcada
    for linha in linhas:
        if _PADRAO_CABECALHO_TRANSACOES.search(linha):
            dentro_secao = True
            continue
        if tem_secao_marcada and dentro_secao and _PADRAO_FIM_SECAO.match(linha):
            dentro_secao = False
            continue
        if not dentro_secao:
            continue

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


def _e_senha_incorreta(e: Exception) -> bool:
    """pdfplumber embrulha PDFPasswordIncorrect numa PdfminerException
    genérica -- a causa original vem em e.args[0] (ver PdfminerException(e)
    dentro do pdfplumber) ou em __context__, dependendo da versão."""
    if isinstance(e, PDFPasswordIncorrect):
        return True
    causa = e.args[0] if e.args else None
    return isinstance(causa, PDFPasswordIncorrect) or isinstance(e.__context__, PDFPasswordIncorrect)


def parse_pdf(conteudo: bytes, ano_referencia: int | None = None, senha: str | None = None) -> list[dict]:
    ano_referencia = ano_referencia or date.today().year
    try:
        with pdfplumber.open(io.BytesIO(conteudo), password=senha or "") as pdf:
            transacoes = _extrair_de_tabelas(pdf, ano_referencia)
            if not transacoes:
                transacoes = _extrair_de_texto(pdf, ano_referencia)
    except (PDFPasswordIncorrect, PdfminerException) as e:
        if not _e_senha_incorreta(e):
            raise
        if senha:
            raise PdfProtegido("Senha do PDF incorreta.") from None
        raise PdfProtegido("Este PDF é protegido por senha. Informe a senha do documento pra importar.") from None
    return transacoes
