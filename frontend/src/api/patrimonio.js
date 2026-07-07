import { apiDelete, apiGet, apiPatch, apiPost } from "./client"

// ---------- Metas (objetivos financeiros) ----------
export const listarMinhasMetas = (token) => apiGet("/clientes/eu/metas", { token })
export const criarMinhaMeta = (token, dados) => apiPost("/clientes/eu/metas", dados, { token })
export const atualizarMinhaMeta = (token, id, dados) =>
  apiPatch(`/clientes/eu/metas/${id}`, dados, { token })
export const excluirMinhaMeta = (token, id) => apiDelete(`/clientes/eu/metas/${id}`, undefined, { token })
export const criarAporteMeta = (token, metaId, dados) =>
  apiPost(`/clientes/eu/metas/${metaId}/aportes`, dados, { token })

// ---------- Dívidas ----------
export const listarMinhasDividas = (token) => apiGet("/clientes/eu/dividas", { token })
export const criarMinhaDivida = (token, dados) => apiPost("/clientes/eu/dividas", dados, { token })
export const atualizarMinhaDivida = (token, id, dados) =>
  apiPatch(`/clientes/eu/dividas/${id}`, dados, { token })
export const excluirMinhaDivida = (token, id) => apiDelete(`/clientes/eu/dividas/${id}`, undefined, { token })

// ---------- Investimentos ----------
export const listarMeusInvestimentos = (token) => apiGet("/clientes/eu/investimentos", { token })
export const criarMeuInvestimento = (token, dados) =>
  apiPost("/clientes/eu/investimentos", dados, { token })
export const atualizarMeuInvestimento = (token, id, dados) =>
  apiPatch(`/clientes/eu/investimentos/${id}`, dados, { token })
export const excluirMeuInvestimento = (token, id) =>
  apiDelete(`/clientes/eu/investimentos/${id}`, undefined, { token })

// ---------- Patrimônio (agregado) ----------
export const obterMeuPatrimonio = (token) => apiGet("/clientes/eu/patrimonio", { token })
export const obterMeuResumoPatrimonial = (token) => apiGet("/clientes/eu/patrimonio/resumo", { token })

// ---------- Saúde financeira (termômetro) ----------
export const obterMinhaSaudeFinanceira = (token) => apiGet("/clientes/eu/saude-financeira", { token })

// ---------- Bens (móveis/imóveis) ----------
export const listarMeusBens = (token) => apiGet("/clientes/eu/bens", { token })
export const criarMeuBem = (token, dados) => apiPost("/clientes/eu/bens", dados, { token })
export const excluirMeuBem = (token, id) => apiDelete(`/clientes/eu/bens/${id}`, undefined, { token })

// ---------- Orçamento por categoria ----------
export const listarMeusOrcamentos = (token, ano, mes) =>
  apiGet(`/clientes/eu/orcamentos?ano=${ano}&mes=${mes}`, { token })
export const criarMeuOrcamento = (token, dados) => apiPost("/clientes/eu/orcamentos", dados, { token })
export const atualizarMeuOrcamento = (token, id, dados) =>
  apiPatch(`/clientes/eu/orcamentos/${id}`, dados, { token })
export const excluirMeuOrcamento = (token, id) =>
  apiDelete(`/clientes/eu/orcamentos/${id}`, undefined, { token })

// ---------- Simulações (Meu Futuro) ----------
export const listarMinhasSimulacoes = (token) => apiGet("/clientes/eu/simulacoes", { token })
export const criarMinhaSimulacao = (token, dados) => apiPost("/clientes/eu/simulacoes", dados, { token })
export const excluirMinhaSimulacao = (token, id) =>
  apiDelete(`/clientes/eu/simulacoes/${id}`, undefined, { token })

// ---------- Minha Proteção (apólices de seguro) ----------
export const obterMinhaProtecao = (token) => apiGet("/clientes/eu/protecao", { token })
export const criarMinhaApolice = (token, dados) => apiPost("/clientes/eu/apolices", dados, { token })
export const excluirMinhaApolice = (token, id) =>
  apiDelete(`/clientes/eu/apolices/${id}`, undefined, { token })
