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
  // Lançamentos (LancamentosTab) agora usa dado real de GET /transacoes.
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
