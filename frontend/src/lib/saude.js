// Classificação de saúde financeira do cliente (termômetro). Mesma taxonomia
// do backend (_classificar_saude): vermelho | amarelo | verde | azul | neutro.
// `faixa` agrupa em 3 baldes pro resumo do planejador (azul entra em verde).
export const SAUDE_INFO = {
  vermelho: {
    cor: "#E5645A",
    label: "Atenção",
    faixa: "vermelho",
    resumo: "Gastando mais do que ganha ou reserva abaixo do mínimo — precisa de atenção.",
  },
  amarelo: {
    cor: "#F0A63C",
    label: "Regular",
    faixa: "amarelo",
    resumo: "Dá pra melhorar — poupança ou reserva ainda abaixo do ideal.",
  },
  verde: {
    cor: "#26D9A8",
    label: "Saudável",
    faixa: "verde",
    resumo: "Poupança e reserva em dia. Situação saudável.",
  },
  azul: {
    cor: "#4C8DFF",
    label: "Excelente",
    faixa: "verde",
    resumo: "Ótima poupança e reserva — rumo à independência financeira.",
  },
  neutro: {
    cor: "#5A6570",
    label: "Sem dados",
    faixa: "sem_dados",
    resumo: "Ainda sem lançamentos suficientes pra avaliar.",
  },
}

export const infoSaude = (classificacao) => SAUDE_INFO[classificacao] || SAUDE_INFO.neutro

// Baldes exibidos no resumo do painel (na ordem: atenção primeiro).
export const FAIXAS_SAUDE = [
  { faixa: "vermelho", label: "Precisam de atenção", cor: "#E5645A" },
  { faixa: "amarelo", label: "Regulares", cor: "#F0A63C" },
  { faixa: "verde", label: "Saudáveis", cor: "#26D9A8" },
  { faixa: "sem_dados", label: "Sem dados", cor: "#5A6570" },
]
