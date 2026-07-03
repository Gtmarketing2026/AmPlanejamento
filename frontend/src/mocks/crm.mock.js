// MOCK: interacoes_crm/follow_ups existem só no schema SQL, sem rota de API.
export const crmMock = {
  perfil: {
    perfilComportamental: "Cauteloso",
    objetivoPrincipal: "Sair do aluguel",
    ultimaInteracao: "há 2 dias",
    proximoFollowUp: "08/07/2026",
    googleSync: true,
  },
  timeline: [
    {
      titulo: "Reunião de revisão trimestral",
      descricao: "Ajustado orçamento de 'Sair do aluguel' — cliente aumentou aporte mensal em R$ 300.",
      data: "28/06/2026",
    },
    {
      titulo: "Alerta automático do sistema",
      descricao:
        "Gasto com cartão 22% acima da média da categoria 'Alimentação' — notificação enviada pro profissional e pro cliente final.",
      data: "21/06/2026 · destinatário: ambos",
    },
    {
      titulo: "Mensagem enviada",
      descricao: "Parabéns pelo marco de 90% da meta 'Viagem Europa' 🎉",
      data: "14/06/2026",
    },
    {
      titulo: "Onboarding concluído",
      descricao: "Open Finance conectado, primeiro relatório gerado.",
      data: "03/06/2026",
    },
  ],
}
