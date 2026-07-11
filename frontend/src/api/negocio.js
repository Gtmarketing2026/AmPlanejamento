import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "./client"

// Token do admin (nível Negócio) — chave própria, separada da do profissional
// (fluxo_token) e da do cliente final (fluxo_cliente_token).
export function setTokenAdmin(token) {
  if (token) localStorage.setItem("fluxo_admin_token", token)
  else localStorage.removeItem("fluxo_admin_token")
}

export function getTokenAdmin() {
  return localStorage.getItem("fluxo_admin_token")
}

// Todas as chamadas /negocio/* passam o token do admin explicitamente. Um 401
// aqui significa sessão de admin expirada/inválida -> limpa o token e avisa o
// layout do Negócio pra mandar de volta pro login (evento próprio, não mexe na
// sessão do profissional).
async function comToken(promessa) {
  try {
    return await promessa
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setTokenAdmin(null)
      window.dispatchEvent(new Event("fluxo:negocio-unauthorized"))
    }
    throw e
  }
}

const auth = () => ({ token: getTokenAdmin() })

export const loginAdmin = (email, senha, codigo_totp) =>
  apiPost("/negocio/login", { email, senha, codigo_totp: codigo_totp || null }, { auth: false })

export const mfaSetup = () => comToken(apiPost("/negocio/mfa/setup", {}, auth()))
export const mfaAtivar = (codigo) => comToken(apiPost("/negocio/mfa/ativar", { codigo }, auth()))
export const mfaDesativar = (codigo) => comToken(apiPost("/negocio/mfa/desativar", { codigo }, auth()))

export const buscarMetricasNegocio = () => comToken(apiGet("/negocio/metricas", auth()))

export const listarPlanejadores = () => comToken(apiGet("/negocio/planejadores", auth()))

export const buscarCapacidade = () => comToken(apiGet("/negocio/capacidade", auth()))

export const listarClientesDoPlanejador = (id) =>
  comToken(apiGet(`/negocio/planejadores/${id}/clientes`, auth()))

export const listarFaturasPlataforma = () => comToken(apiGet("/negocio/financeiro/faturas", auth()))

export const listarDespesas = () => comToken(apiGet("/negocio/despesas", auth()))

export const criarDespesa = (dados) => comToken(apiPost("/negocio/despesas", dados, auth()))

export const excluirDespesa = (id) => comToken(apiDelete(`/negocio/despesas/${id}`, undefined, auth()))

export const buscarPerfilAdmin = () => comToken(apiGet("/negocio/perfil", auth()))

export const atualizarPerfilAdmin = (dados) => comToken(apiPatch("/negocio/perfil", dados, auth()))

export const atualizarCredenciaisPlanejador = (id, dados) =>
  comToken(apiPatch(`/negocio/planejadores/${id}/credenciais`, dados, auth()))

export const atualizarCredenciaisCliente = (id, dados) =>
  comToken(apiPatch(`/negocio/clientes/${id}/credenciais`, dados, auth()))

export const entrarComoPlanejador = (id) => comToken(apiPost(`/negocio/planejadores/${id}/entrar`, {}, auth()))

export const entrarComoCliente = (id) => comToken(apiPost(`/negocio/clientes/${id}/entrar`, {}, auth()))

export const atualizarStatusPlanejador = (id, dados) =>
  comToken(apiPatch(`/negocio/planejadores/${id}/status`, dados, auth()))

export const concederTrial = (id, dados) => comToken(apiPatch(`/negocio/planejadores/${id}/trial`, dados, auth()))

export const concederVagas = (id, dados) => comToken(apiPatch(`/negocio/planejadores/${id}/vagas`, dados, auth()))

export const atualizarStatusCliente = (id, dados) =>
  comToken(apiPatch(`/negocio/clientes/${id}/status`, dados, auth()))

// Move o cliente inteiro (contas, lançamentos, dívidas, etc.) pra outro planejador.
export const mudarPlanejadorCliente = (id, profissionalId) =>
  comToken(apiPatch(`/negocio/clientes/${id}/planejador`, { profissional_id: profissionalId }, auth()))

// Exclusão PERMANENTE (admin) — cascata no banco. Diferente do status reversível.
export const excluirPlanejadorNegocio = (id) => comToken(apiDelete(`/negocio/planejadores/${id}`, undefined, auth()))
export const excluirClienteNegocio = (id) => comToken(apiDelete(`/negocio/clientes/${id}`, undefined, auth()))

// ---------- Novidades do sistema (changelog) — autoria pela plataforma ----------
export const listarAtualizacoes = () => comToken(apiGet("/negocio/atualizacoes", auth()))
export const criarAtualizacao = (dados) => comToken(apiPost("/negocio/atualizacoes", dados, auth()))
export const atualizarAtualizacao = (id, dados) =>
  comToken(apiPatch(`/negocio/atualizacoes/${id}`, dados, auth()))
export const excluirAtualizacao = (id) =>
  comToken(apiDelete(`/negocio/atualizacoes/${id}`, undefined, auth()))
