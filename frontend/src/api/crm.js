import { apiDelete, apiGet, apiPatch, apiPost } from "./client"

// ---------- Timeline de interações ----------
export const listarInteracoes = (clienteId) => apiGet(`/crm/clientes/${clienteId}/interacoes`)

export const criarInteracao = (clienteId, dados) =>
  apiPost(`/crm/clientes/${clienteId}/interacoes`, dados)

export const excluirInteracao = (id) => apiDelete(`/crm/interacoes/${id}`)

// ---------- Follow-ups ----------
export const listarFollowUps = (apenasPendentes = true) =>
  apiGet(`/crm/follow-ups?apenas_pendentes=${apenasPendentes}`)

export const listarFollowUpsCliente = (clienteId) =>
  apiGet(`/crm/clientes/${clienteId}/follow-ups`)

export const criarFollowUp = (clienteId, dados) =>
  apiPost(`/crm/clientes/${clienteId}/follow-ups`, dados)

export const atualizarFollowUp = (id, dados) => apiPatch(`/crm/follow-ups/${id}`, dados)

export const excluirFollowUp = (id) => apiDelete(`/crm/follow-ups/${id}`)

// ---------- Google Agenda ----------
export const googleStatus = () => apiGet("/crm/google/status")

export const googleConectar = () => apiGet("/crm/google/conectar")

export const googleDesconectar = () => apiDelete("/crm/google/desconectar")
