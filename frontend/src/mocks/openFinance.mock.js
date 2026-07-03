// MOCK: não existe endpoint de consentimento Open Finance no backend ainda
// (contas_conectadas só existe como tabela SQL, sem rota). Dado ilustrativo.
export const openFinanceMock = {
  clienteNome: "Marina",
  planejadorNome: "Renata Souza",
  subdominio: "renatasouza",
  permissoes: [
    "Saldo e extrato de conta",
    "Faturas e transações de cartão",
    "Autorização única — 12 meses, auto-renovada",
    "Revogável a qualquer tempo",
  ],
}
