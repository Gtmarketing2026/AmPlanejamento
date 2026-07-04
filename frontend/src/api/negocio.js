import { apiDelete, apiGet, apiPost, ApiError } from "./client"

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

export const loginAdmin = (email, senha) => apiPost("/negocio/login", { email, senha }, { auth: false })

export const buscarMetricasNegocio = () => comToken(apiGet("/negocio/metricas", auth()))

export const listarPlanejadores = () => comToken(apiGet("/negocio/planejadores", auth()))

export const listarClientesDoPlanejador = (id) =>
  comToken(apiGet(`/negocio/planejadores/${id}/clientes`, auth()))

export const listarTransacoesDoCliente = (id) =>
  comToken(apiGet(`/negocio/clientes/${id}/transacoes`, auth()))

export const listarFaturasPlataforma = () => comToken(apiGet("/negocio/financeiro/faturas", auth()))

export const listarDespesas = () => comToken(apiGet("/negocio/despesas", auth()))

export const criarDespesa = (dados) => comToken(apiPost("/negocio/despesas", dados, auth()))

export const excluirDespesa = (id) => comToken(apiDelete(`/negocio/despesas/${id}`, undefined, auth()))
