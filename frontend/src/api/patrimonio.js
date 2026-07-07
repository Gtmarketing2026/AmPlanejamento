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

// ---------- Simulações (Meu Futuro) ----------
export const listarMinhasSimulacoes = (token) => apiGet("/clientes/eu/simulacoes", { token })
export const criarMinhaSimulacao = (token, dados) => apiPost("/clientes/eu/simulacoes", dados, { token })
export const excluirMinhaSimulacao = (token, id) =>
  apiDelete(`/clientes/eu/simulacoes/${id}`, undefined, { token })
