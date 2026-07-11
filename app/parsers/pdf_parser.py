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
# "Parcela 03/10" antes de uma data (com qualquer quantidade de espaço) --
# algumas faturas (ex: Pan) marcam a parcela nesse formato "NN/NN" sem
# parênteses, idêntico a uma data; usado pra não confundir com a data real
# da transação (lookbehind de largura fixa não serve aqui por causa do
# espaço variável entre a palavra e os dígitos).
_PADRAO_PRECEDIDO_DE_PARCELA = re.compile(r"parcela\s*$", re.IGNORECASE)

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
                descricao = next((c for c in celulas if c not in (data_match, valor_match)), "")
                # Linha só com data + valor, sem nenhuma descrição, é quase sempre
                # a coluna de "saldo do dia"/subtotal do extrato -- não é lançamento.
                # Capturá-la cria uma "entrada" fantasma (ver investigação Sabrina).
                if not descricao.strip():
                    continue
                transacoes.append(
                    {
                        "data": data,
                        "descricao": descricao.strip(),
                        "valor": abs(valor),
                        "tipo": "entrada" if valor >= 0 else "saida",
                    }
                )
    return transacoes


def _pares_data_valor_da_linha(linha: str) -> list[tuple[str, str, str]]:
    """Extrai TODOS os pares (data, descrição, valor) de uma linha -- algumas
    faturas (ex: Pan) imprimem duas transações lado a lado na mesma linha
    visual (layout em 2 colunas), então uma única data+valor por linha (via
    `.search()`) descartava a segunda transação inteira. Casa cada data com
    o primeiro valor que vem depois dela no texto, na ordem em que aparecem."""
    datas = [
        m for m in _PADRAO_DATA.finditer(linha) if not _PADRAO_PRECEDIDO_DE_PARCELA.search(linha[: m.start()])
    ]
    valores = list(_PADRAO_VALOR.finditer(linha))
    pares = []
    vi = 0
    for dm in datas:
        while vi < len(valores) and valores[vi].start() < dm.end():
            vi += 1
        if vi >= len(valores):
            break
        vm = valores[vi]
        descricao = linha[dm.end() : vm.start()].strip()
        pares.append((dm.group(1), descricao, vm.group(1)))
        vi += 1
    return pares


def _eh_linha_so_valor_estrangeiro(linha: str) -> str | None:
    """Algumas faturas mostram compra no exterior em 3 linhas: valor em
    moeda estrangeira + valor em R$ numa linha (ex: "$ 10,00 | R$ 54,80"),
    a data/descrição na linha seguinte, e a cotação do dólar depois. Aqui
    identifica a 1ª linha (só valores e "|", sem nenhuma outra palavra) e
    devolve o último valor (o em R$, que vem depois do valor estrangeiro)."""
    if "|" not in linha:
        return None
    valores = list(_PADRAO_VALOR.finditer(linha))
    if not valores:
        return None
    resto = _PADRAO_VALOR.sub("", linha)
    if not re.fullmatch(r"[\s|]*", resto):
        return None
    return valores[-1].group(1)


def _extrair_de_texto(pdf: "pdfplumber.PDF", ano_referencia: int) -> list[dict]:
    linhas = []
    for pagina in pdf.pages:
        # x_tolerance baixo evita que o pdfplumber cole palavras sem espaço
        # em fontes mais compactas (ex: "PagamentoEfetuado" vira "Pagamento
        # Efetuado") -- sem isso a descrição vem ilegível e o filtro de
        # linha agregada (que depende de \s entre palavras) não pega.
        texto = pagina.extract_text(x_tolerance=1) or pagina.extract_text() or ""
        linhas.extend(texto.splitlines())
    return _transacoes_de_linhas(linhas, ano_referencia)


def parse_texto(texto: str, ano_referencia: int | None = None) -> list[dict]:
    """Extrai lançamentos de um TEXTO cru (ex: saída de OCR), reaproveitando a
    mesma lógica de linhas do PDF. Usado como fallback quando o PDF é ilegível."""
    ano_referencia = ano_referencia or date.today().year
    return _transacoes_de_linhas((texto or "").splitlines(), ano_referencia)


def _transacoes_de_linhas(linhas: list[str], ano_referencia: int) -> list[dict]:
    tem_secao_marcada = any(_PADRAO_CABECALHO_TRANSACOES.search(linha) for linha in linhas)

    transacoes = []
    # Sem cabeçalho reconhecível, mantém o comportamento antigo (varre tudo).
    dentro_secao = not tem_secao_marcada
    valor_pendente: str | None = None  # linha só de valor (compra no exterior), aguardando a data na próxima linha
    for linha in linhas:
        if _PADRAO_CABECALHO_TRANSACOES.search(linha):
            dentro_secao = True
            valor_pendente = None
            continue
        if tem_secao_marcada and dentro_secao and _PADRAO_FIM_SECAO.match(linha):
            dentro_secao = False
            valor_pendente = None
            continue
        if not dentro_secao:
            continue

        pares = _pares_data_valor_da_linha(linha)
        if pares:
            valor_pendente = None
            for data_bruta, descricao, valor_bruto in pares:
                data = _parsear_data(data_bruta, ano_referencia)
                valor = _parsear_valor(valor_bruto)
                if data is None or valor is None:
                    continue
                # Data + valor sem nenhum texto entre eles = linha de "saldo do
                # dia"/subtotal, não um lançamento (ver investigação Sabrina).
                if not descricao.strip():
                    continue
                transacoes.append(
                    {
                        "data": data,
                        "descricao": descricao,
                        "valor": abs(valor),
                        "tipo": "entrada" if valor >= 0 else "saida",
                    }
                )
            continue

        valor_estrangeiro = _eh_linha_so_valor_estrangeiro(linha)
        if valor_estrangeiro is not None:
            valor_pendente = valor_estrangeiro
            continue

        if valor_pendente is not None:
            data_match = _PADRAO_DATA.search(linha)
            if data_match:
                data = _parsear_data(data_match.group(1), ano_referencia)
                valor = _parsear_valor(valor_pendente)
                descricao = linha.replace(data_match.group(0), "").strip()
                valor_pendente = None
                if data is not None and valor is not None and descricao:
                    transacoes.append(
                        {
                            "data": data,
                            "descricao": descricao,
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
            transacoes_tabelas = _extrair_de_tabelas(pdf, ano_referencia)
            transacoes_texto = _extrair_de_texto(pdf, ano_referencia)
            # Em faturas que imprimem 2 transações lado a lado na mesma linha
            # (layout em 2 colunas), a extração por tabela do pdfplumber só
            # enxerga uma das colunas e descarta a outra silenciosamente --
            # usa sempre o método que capturou mais lançamentos.
            transacoes = transacoes_texto if len(transacoes_texto) > len(transacoes_tabelas) else transacoes_tabelas
    except (PDFPasswordIncorrect, PdfminerException) as e:
        if not _e_senha_incorreta(e):
            raise
        if senha:
            raise PdfProtegido("Senha do PDF incorreta.") from None
        raise PdfProtegido("Este PDF é protegido por senha. Informe a senha do documento pra importar.") from None
    return transacoes
