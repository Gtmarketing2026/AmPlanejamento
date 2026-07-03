// MOCK: importacoes_extrato existe só no schema SQL, sem parser OFX/CSV/PDF
// nem rota de upload implementados ainda.
export const importExtratoMockInicial = [
  { arquivo: "extrato_junho.ofx", periodo: "jun/2026", transacoes: "142 novas", status: "processado" },
  { arquivo: "fatura_nubank_jun.pdf", periodo: "jun/2026", transacoes: "38 novas · 4 dup.", status: "processado" },
  { arquivo: "extrato_maio.csv", periodo: "mai/2026", transacoes: "—", status: "processando" },
  { arquivo: "fatura_itau_abr.pdf", periodo: "abr/2026", transacoes: "0", status: "erro" },
]
