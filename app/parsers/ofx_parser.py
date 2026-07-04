"""
Parser de extrato/fatura em OFX -- formato padronizado (Open Financial
Exchange), o mais confiável dos três porque não varia por banco.
"""

import io

from ofxparse import OfxParser


def parse_ofx(conteudo: bytes) -> list[dict]:
    """Retorna uma lista de {data, descricao, valor, tipo} -- valor sempre
    positivo, tipo indica o sinal ('entrada' | 'saida')."""
    ofx = OfxParser.parse(io.BytesIO(conteudo))

    transacoes = []
    for account in ofx.accounts:
        if not account.statement:
            continue
        for t in account.statement.transactions:
            valor = float(t.amount)
            transacoes.append(
                {
                    "data": t.date.date(),
                    "descricao": (t.memo or t.payee or "Sem descrição").strip(),
                    "valor": abs(valor),
                    "tipo": "entrada" if valor >= 0 else "saida",
                }
            )
    return transacoes
