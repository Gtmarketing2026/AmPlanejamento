// MOCK (parcial): os nomes abaixo espelham o seed real de schema_seguranca.sql
// (categorias/instituições padrão do sistema), mas a listagem/adição aqui é
// só local — GET/POST de categorias/subcategorias/instituições/tags ainda
// não tem rota de API, só existe a tabela.
export const cadastrosMockInicial = {
  bancos: [
    "Mercado Pago", "Itaú", "Nubank", "XP Banking", "Banco PAN", "Banco Sofisa",
    "Nomad", "ABC Brasil", "Bradesco", "Santander", "Banco do Brasil", "Caixa",
    "Inter", "C6 Bank", "BTG Pactual",
  ].map((nome) => ({ nome, origem: "padrao" })),
  categorias: [
    "Despesas obrigatórias", "Despesas não obrigatórias", "Financiamentos", "Dívidas",
    "Renda", "Investimentos", "Classificação neutra", "Empresa e autônomo", "Projetos",
  ].map((nome) => ({ nome, origem: "padrao" })),
  subcategorias: {
    "Despesas obrigatórias": [
      "Alimentação", "Casa", "Cuidados pessoais", "Educação", "Filhos e família",
      "Mercado", "Saúde", "Transporte",
    ].map((nome) => ({ nome, origem: "padrao" })),
    "Empresa e autônomo": [
      "Meios de pagamento", "Infraestrutura", "Ferramentas", "Marketing", "Colaboradores",
    ].map((nome) => ({ nome, origem: "padrao" })),
  },
  tags: [],
}
