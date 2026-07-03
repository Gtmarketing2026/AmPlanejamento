"""
Script de validação da API Pluggy (Open Finance)
---------------------------------------------------
Objetivo: confirmar se os dados retornados pela Pluggy batem com o schema
do app de planejamento financeiro antes de fechar contrato comercial.

Como usar:
1. Crie uma conta em https://dashboard.pluggy.ai e pegue CLIENT_ID e CLIENT_SECRET
2. Use o Connect Widget (frontend) ou o Meu Pluggy para conectar uma conta real
   e gerar um ITEM_ID (o widget retorna isso no callback onSuccess)
3. Preencha as constantes abaixo
4. Rode: python testar_pluggy.py

O script salva cada resposta em /home/claude/pluggy_output/*.json
para você inspecionar os campos com calma.
"""

import json
import os
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO — preencha antes de rodar
# ---------------------------------------------------------------------------
CLIENT_ID = "SEU_CLIENT_ID_AQUI"
CLIENT_SECRET = "SEU_CLIENT_SECRET_AQUI"
ITEM_ID = "SEU_ITEM_ID_AQUI"  # gerado depois de conectar uma conta via widget

BASE_URL = "https://api.pluggy.ai"
OUTPUT_DIR = Path("/home/claude/pluggy_output")


# ---------------------------------------------------------------------------
# AUTENTICAÇÃO
# ---------------------------------------------------------------------------
def autenticar() -> str:
    """Troca client_id/client_secret por um apiKey de curta duração."""
    resp = requests.post(
        f"{BASE_URL}/auth",
        json={"clientId": CLIENT_ID, "clientSecret": CLIENT_SECRET},
        timeout=30,
    )
    resp.raise_for_status()
    api_key = resp.json()["apiKey"]
    print("✅ Autenticado com sucesso.")
    return api_key


def salvar_json(nome: str, dados: dict) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    caminho = OUTPUT_DIR / f"{nome}.json"
    caminho.write_text(json.dumps(dados, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"   ↳ salvo em {caminho}")


# ---------------------------------------------------------------------------
# 1. STATUS DO ITEM / CONSENTIMENTO
# ---------------------------------------------------------------------------
def checar_item(api_key: str) -> dict:
    """
    Valida: status da conexão, status do consentimento, e se dá pra
    identificar quando o cliente revogou o acesso pelo próprio banco.
    """
    print("\n[1] Checando status do item (conexão/consentimento)...")
    headers = {"X-API-KEY": api_key}
    resp = requests.get(f"{BASE_URL}/items/{ITEM_ID}", headers=headers, timeout=30)
    resp.raise_for_status()
    item = resp.json()
    salvar_json("1_item_status", item)

    print(f"   status: {item.get('status')}")
    print(f"   executionStatus: {item.get('executionStatus')}")
    consent = item.get("consentExpiresAt") or item.get("statusDetail")
    print(f"   consentimento/expiração: {consent}")

    if item.get("status") in ("LOGIN_ERROR", "OUTDATED", "ERROR"):
        print("   ⚠️  Item com problema — bom caso de teste pra ver como sua UI reage.")

    return item


# ---------------------------------------------------------------------------
# 2. CONTAS (PF vs PJ)
# ---------------------------------------------------------------------------
def checar_contas(api_key: str) -> list:
    """
    Valida: quais campos vêm em conta PF vs PJ, saldo, tipo de conta,
    e se há diferença estrutural que seu schema precisa acomodar.
    """
    print("\n[2] Checando contas conectadas...")
    headers = {"X-API-KEY": api_key}
    resp = requests.get(
        f"{BASE_URL}/accounts", headers=headers, params={"itemId": ITEM_ID}, timeout=30
    )
    resp.raise_for_status()
    contas = resp.json().get("results", [])
    salvar_json("2_contas", {"results": contas})

    for conta in contas:
        print(f"   conta: {conta.get('name')} | tipo: {conta.get('type')} "
              f"| subtype: {conta.get('subtype')} | saldo: {conta.get('balance')}")
        owner = conta.get("owner")
        tax_number = conta.get("taxNumber")
        print(f"   titular: {owner} | documento: {tax_number}")

    return contas


# ---------------------------------------------------------------------------
# 3. TRANSAÇÕES (categorização + conciliação conta x cartão)
# ---------------------------------------------------------------------------
def checar_transacoes(api_key: str, account_id: str) -> list:
    """
    Valida: categorização automática, se transação de cartão vem linkada
    à conta de pagamento, quantos meses de histórico vêm de uma vez.
    """
    print(f"\n[3] Checando transações da conta {account_id}...")
    headers = {"X-API-KEY": api_key}
    resp = requests.get(
        f"{BASE_URL}/transactions",
        headers=headers,
        params={"accountId": account_id, "pageSize": 50},
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()
    transacoes = payload.get("results", [])
    salvar_json(f"3_transacoes_{account_id}", payload)

    print(f"   total retornado nesta página: {len(transacoes)} "
          f"de {payload.get('total', '?')} totais")

    categorias_vazias = sum(1 for t in transacoes if not t.get("category"))
    print(f"   transações SEM categoria automática: {categorias_vazias}/{len(transacoes)}")

    if transacoes:
        exemplo = transacoes[0]
        print("   exemplo de transação:")
        print(f"     descrição: {exemplo.get('description')}")
        print(f"     valor: {exemplo.get('amount')}")
        print(f"     categoria: {exemplo.get('category')}")
        print(f"     data: {exemplo.get('date')}")
        print(f"     paymentData (fatura/cartão): {exemplo.get('paymentData')}")

    if transacoes:
        datas = [t.get("date") for t in transacoes if t.get("date")]
        if datas:
            print(f"   intervalo de datas retornado: {min(datas)} até {max(datas)}")

    return transacoes


# ---------------------------------------------------------------------------
# 4. INVESTIMENTOS (opcional — decide se entra no MVP ou fase 2)
# ---------------------------------------------------------------------------
def checar_investimentos(api_key: str) -> list:
    print("\n[4] Checando se há dados de investimento conectados...")
    headers = {"X-API-KEY": api_key}
    resp = requests.get(
        f"{BASE_URL}/investments", headers=headers, params={"itemId": ITEM_ID}, timeout=30
    )
    if resp.status_code == 404:
        print("   nenhum investimento disponível para este item.")
        return []
    resp.raise_for_status()
    investimentos = resp.json().get("results", [])
    salvar_json("4_investimentos", {"results": investimentos})
    print(f"   {len(investimentos)} produto(s) de investimento encontrado(s).")
    return investimentos


# ---------------------------------------------------------------------------
# EXECUÇÃO
# ---------------------------------------------------------------------------
def main() -> None:
    if "SEU_" in CLIENT_ID or "SEU_" in CLIENT_SECRET or "SEU_" in ITEM_ID:
        print("⚠️  Preencha CLIENT_ID, CLIENT_SECRET e ITEM_ID antes de rodar.")
        print("    CLIENT_ID/SECRET: dashboard.pluggy.ai")
        print("    ITEM_ID: gerado ao conectar uma conta via Connect Widget ou Meu Pluggy")
        return

    api_key = autenticar()

    item = checar_item(api_key)
    contas = checar_contas(api_key)

    for conta in contas:
        checar_transacoes(api_key, conta["id"])

    checar_investimentos(api_key)

    print("\n" + "=" * 60)
    print("Checklist de decisão — confira manualmente:")
    print("=" * 60)
    print("[ ] Categoria automática veio preenchida na maioria das transações?")
    print("[ ] Transação de cartão está linkada à conta, ou precisa casar na mão?")
    print("[ ] Campos de PJ (CNPJ, razão social) apareceram quando esperado?")
    print("[ ] Histórico trazido cobre pelo menos 1 ciclo de faturamento?")
    print("[ ] Status do item muda de forma clara quando você revoga no banco?")
    print(f"\nRespostas completas salvas em: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
