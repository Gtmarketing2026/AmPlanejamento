// MOCK: transacoes/metas/dividas/patrimonio_snapshots existem só no schema SQL,
// sem rota de API ainda. Dado ilustrativo pra manter a tela navegável.
export const dashboardMock = {
  saudeFinanceira: { pct: 70, status: "Verde", reservaMeses: 6.2, taxaPoupanca: 26 },
  fluxoCaixa: {
    entradas: 9240,
    entradasDelta: "↑ 6% vs. mai",
    saidas: 6815,
    saidasDelta: "↑ 11% vs. mai",
    conciliadoPct: 98,
    pendentes: "3 lançamentos pendentes",
  },
  gastoPorCategoria: [
    { label: "Moradia", pct: 78, valor: "R$ 2.100" },
    { label: "Cartão de crédito", pct: 60, valor: "R$ 1.640" },
    { label: "Alimentação", pct: 38, valor: "R$ 980" },
    { label: "Transporte", pct: 22, valor: "R$ 540" },
    { label: "Outros", pct: 15, valor: "R$ 355" },
  ],
  ultimasConciliacoes: [
    { label: "Fatura Nubank", valor: "R$ 1.640" },
    { label: "Aluguel", valor: "R$ 2.100" },
    { label: "Transf. não identificada", valor: "R$ 210" },
    { label: "Mercado", valor: "R$ 486" },
  ],
  filtros: {
    tipos: ["Entradas e saídas", "Só entradas", "Só saídas"],
    instituicoes: ["Todas", "Nubank", "Itaú", "Mercado Pago"],
    categorias: ["Todas", "Despesas obrigatórias", "Despesas não obrigatórias", "Renda"],
    subcategorias: ["Todas", "Mercado", "Transporte"],
    cartoes: ["Todos", "Nubank •••• 4471", "Itaú •••• 2290"],
  },
  transacoes: [
    { icone: "🏠", categoria: "Mercado", data: "28/06", compra: "Supermercado Extra", origem: "Nubank •••• 4471", parcela: "—", tags: ["casa"], valor: "- R$ 486,20", tipo: "saida" },
    { icone: "🛍️", categoria: "Compras", data: "27/06", compra: "Notebook Dell — Magazine Luiza", origem: "Itaú •••• 2290", parcela: "3/10", tags: ["trabalho"], valor: "- R$ 289,90", tipo: "saida" },
    { icone: "💰", categoria: "Renda", data: "25/06", compra: "Salário", origem: "Mercado Pago", parcela: "—", tags: [], valor: "+ R$ 6.200,00", tipo: "entrada" },
    { icone: "🏠", categoria: "Saúde", data: "22/06", compra: "Academia — mensalidade", origem: "Nubank •••• 4471", parcela: "—", tags: [], valor: "- R$ 129,90", tipo: "saida" },
    { icone: "🔄", categoria: "Pgto. fatura", data: "20/06", compra: "Pagamento fatura cartão", origem: "Itaú — conta corrente", parcela: "—", tags: [], valor: "- R$ 1.640,00", tipo: "saida" },
  ],
  patrimonio: { atual: "R$ 184.200", delta: "↑ 3,1% no mês", metaAposentadoriaPct: "42%", anoProjecao: "projeção: 2049", reservaMeses: "6,2 meses" },
  curvaProjecao: [40, 55, 68, 90, 130, 184],
  curvaProjecaoLabels: ["hoje", "", "", "+5 anos", "", "+15 anos"],
  simulador: { taxaAnual: 9.5, prazoAnos: 15, patrimonioBase: 184200 },
  projetos: [
    { nome: "Sair do aluguel", pct: 71 },
    { nome: "Viagem Europa", pct: 94 },
    { nome: "Quitar dívida cartão", pct: 38 },
    { nome: "Aposentadoria", pct: 42 },
  ],
  dividas: [
    { credor: "Itaú", tipo: "Financ. veículo", restante: "R$ 18.400", parcelas: "14/36", previsao: "mar/2029" },
    { credor: "Nubank", tipo: "Cartão parcelado", restante: "R$ 2.010", parcelas: "3/10", previsao: "out/2026" },
  ],
}
