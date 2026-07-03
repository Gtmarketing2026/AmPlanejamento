// MOCK: vw_metricas_carteira e vw_retencao_clientes ja existem como VIEWS no
// schema SQL, mas nenhuma rota de API expoe elas ao profissional ainda
// (so /admin/metricas existe, e e cross-tenant pra admin, nao por carteira).
export const painelAnaliticoMock = {
  kpis: {
    clientesAtivos: { valor: "18", delta: "12 PF · 6 PJ" },
    patrimonioTotalCarteira: { valor: "R$ 3,8M", delta: "↑ 6,2% no trimestre" },
    crescimentoMedio: { valor: "2,1%", delta: "ao mês, média da carteira" },
    ticketMedio: { valor: "R$ 340", delta: "honorário mensal / cliente" },
    ltvMedio: { valor: "R$ 6.920", delta: "baseado em retenção real da carteira" },
    taxaPoupancaMedia: { valor: "31%", delta: "carteira saudável" },
  },
  evolucaoCarteira: [2.8, 3.0, 3.2, 3.4, 3.6, 3.8],
  evolucaoCarteiraLabels: ["fev", "mar", "abr", "mai", "jun", "jul"],
  temperatura: { engajados: 11, atencao: 5, risco: 2 },
  topClientes: [
    { nome: "Marina Castro", iniciais: "MC", tipo: "PF", evolucao: "↑ 18%", honorario: "R$ 390", temperatura: "engajado" },
    { nome: "Renata Souza ME", iniciais: "RS", tipo: "PJ", evolucao: "↑ 14%", honorario: "R$ 520", temperatura: "engajado" },
    { nome: "João Prado", iniciais: "JP", tipo: "PF", evolucao: "↑ 11%", honorario: "R$ 280", temperatura: "atenção" },
    { nome: "Camila Lopes", iniciais: "CL", tipo: "PF", evolucao: "↑ 9%", honorario: "R$ 310", temperatura: "engajado" },
  ],
}
