// MOCK: store compartilhado entre ImportarExtratoPage e o Dashboard, só pra
// simular o efeito cascata (excluir importação remove os lançamentos dela)
// sem precisar de backend real ainda. Usa useSyncExternalStore (nativo do
// React) em vez de prop-drilling ou lib de estado nova.
import { useSyncExternalStore } from "react"

let importacoes = [
  { id: "imp-1", arquivo: "extrato_junho.ofx", periodo: "jun/2026", transacoesCount: 3, status: "processado" },
  { id: "imp-2", arquivo: "fatura_nubank_jun.pdf", periodo: "jun/2026", transacoesCount: 2, status: "processado" },
  { id: "imp-3", arquivo: "extrato_maio.csv", periodo: "mai/2026", transacoesCount: 0, status: "processando" },
  { id: "imp-4", arquivo: "fatura_itau_abr.pdf", periodo: "abr/2026", transacoesCount: 0, status: "erro" },
]

let transacoes = [
  { id: "t1", icone: "🏠", categoria: "Mercado", data: "28/06", compra: "Supermercado Extra", origem: "Nubank •••• 4471", parcela: "—", tags: ["casa"], valor: "- R$ 486,20", tipo: "saida", importacaoId: "imp-1" },
  { id: "t2", icone: "🛍️", categoria: "Compras", data: "27/06", compra: "Notebook Dell — Magazine Luiza", origem: "Itaú •••• 2290", parcela: "3/10", tags: ["trabalho"], valor: "- R$ 289,90", tipo: "saida", importacaoId: null },
  { id: "t3", icone: "💰", categoria: "Renda", data: "25/06", compra: "Salário", origem: "Mercado Pago", parcela: "—", tags: [], valor: "+ R$ 6.200,00", tipo: "entrada", importacaoId: "imp-1" },
  { id: "t4", icone: "🏠", categoria: "Saúde", data: "22/06", compra: "Academia — mensalidade", origem: "Nubank •••• 4471", parcela: "—", tags: [], valor: "- R$ 129,90", tipo: "saida", importacaoId: "imp-1" },
  { id: "t5", icone: "🔄", categoria: "Pgto. fatura", data: "20/06", compra: "Pagamento fatura cartão", origem: "Itaú — conta corrente", parcela: "—", tags: [], valor: "- R$ 1.640,00", tipo: "saida", importacaoId: "imp-2" },
  { id: "t6", icone: "🛍️", categoria: "Compras", data: "19/06", compra: "Fatura Nubank — parcial", origem: "Nubank •••• 4471", parcela: "—", tags: [], valor: "- R$ 412,00", tipo: "saida", importacaoId: "imp-2" },
]

const listeners = new Set()

function emitir() {
  listeners.forEach((l) => l())
}

export function adicionarImportacao(item) {
  importacoes = [item, ...importacoes]
  emitir()
}

export function marcarProcessada(id, transacoesCount) {
  importacoes = importacoes.map((i) => (i.id === id ? { ...i, status: "processado", transacoesCount } : i))
  emitir()
}

export function excluirImportacao(id) {
  importacoes = importacoes.filter((i) => i.id !== id)
  transacoes = transacoes.filter((t) => t.importacaoId !== id)
  emitir()
}

function subscribe(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

export function useImportacoes() {
  return useSyncExternalStore(subscribe, () => importacoes)
}

export function useTransacoes() {
  return useSyncExternalStore(subscribe, () => transacoes)
}
