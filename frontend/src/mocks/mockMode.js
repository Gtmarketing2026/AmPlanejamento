// Switchboard central: cada tela mockada checa a própria flag aqui. Quando o
// endpoint real existir no backend, troca a flag pra false E troca o
// mock.*.js pela chamada real em api/ (o hook já fica estruturado pra isso).
export const MOCK_MODE = {
  openFinance: true,
  dashboard: true,
  crm: true,
  whiteLabel: true,
  painelAnalitico: true,
  importExtrato: false, // real: POST/GET /importacoes, GET /transacoes
  cadastros: true,
}
