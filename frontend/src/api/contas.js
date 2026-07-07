import { apiDelete, apiGet, apiPatch, apiPost } from "./client"

// ---------- Minhas Contas (cliente) ----------
export const listarMinhasContas = (token) => apiGet("/clientes/eu/contas", { token })
export const criarMinhaConta = (token, dados) => apiPost("/clientes/eu/contas", dados, { token })
export const atualizarMinhaConta = (token, id, dados) =>
  apiPatch(`/clientes/eu/contas/${id}`, dados, { token })
export const excluirMinhaConta = (token, id) => apiDelete(`/clientes/eu/contas/${id}`, undefined, { token })

// ---------- Contas de um cliente (planejador) ----------
export const listarContasDoCliente = (clienteId) => apiGet(`/clientes/${clienteId}/contas`)

// ---------- Preferências (cliente) ----------
export const obterMinhasPreferencias = (token) => apiGet("/clientes/eu/preferencias", { token })
export const atualizarMinhasPreferencias = (token, dados) =>
  apiPatch("/clientes/eu/preferencias", dados, { token })
