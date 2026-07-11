import { apiDelete, apiGet, apiPatch, apiPost } from "./client"

// ---------- Timeline de interações ----------
export const listarInteracoes = (clienteId) => apiGet(`/crm/clientes/${clienteId}/interacoes`)

export const criarInteracao = (clienteId, dados) =>
  apiPost(`/crm/clientes/${clienteId}/interacoes`, dados)

export const excluirInteracao = (id) => apiDelete(`/crm/interacoes/${id}`)

// ---------- Tarefas do cliente ----------
export const listarTarefasCliente = (clienteId) => apiGet(`/crm/clientes/${clienteId}/tarefas`)

export const criarTarefaCliente = (clienteId, dados) =>
  apiPost(`/crm/clientes/${clienteId}/tarefas`, dados)

export const atualizarTarefaCliente = (id, dados) => apiPatch(`/crm/tarefas/${id}`, dados)

export const excluirTarefaCliente = (id) => apiDelete(`/crm/tarefas/${id}`)

// ---------- Notificações (mensagem direta do profissional pro cliente) ----------
export const enviarNotificacaoCliente = (clienteId, dados) =>
  apiPost(`/crm/clientes/${clienteId}/notificacoes`, dados)

// ---------- Follow-ups ----------
export const listarFollowUps = (apenasPendentes = true) =>
  apiGet(`/crm/follow-ups?apenas_pendentes=${apenasPendentes}`)

export const listarFollowUpsCliente = (clienteId) =>
  apiGet(`/crm/clientes/${clienteId}/follow-ups`)

export const criarFollowUp = (clienteId, dados) =>
  apiPost(`/crm/clientes/${clienteId}/follow-ups`, dados)

export const atualizarFollowUp = (id, dados) => apiPatch(`/crm/follow-ups/${id}`, dados)

export const excluirFollowUp = (id) => apiDelete(`/crm/follow-ups/${id}`)

// ---------- Plano de ação (roadmap onde estou -> onde quero chegar) ----------
export const listarPlanoEtapas = (clienteId) => apiGet(`/crm/clientes/${clienteId}/plano-etapas`)

export const criarPlanoEtapa = (clienteId, dados) =>
  apiPost(`/crm/clientes/${clienteId}/plano-etapas`, dados)

export const atualizarPlanoEtapa = (id, dados) => apiPatch(`/crm/plano-etapas/${id}`, dados)

export const excluirPlanoEtapa = (id) => apiDelete(`/crm/plano-etapas/${id}`)

// ---------- Google Agenda ----------
export const googleStatus = () => apiGet("/crm/google/status")

export const googleConectar = () => apiGet("/crm/google/conectar")

export const googleDesconectar = () => apiDelete("/crm/google/desconectar")

// ---------- Novidades do sistema (planejador) ----------
export const obterNovidadesPlanejador = () => apiGet("/crm/novidades")
export const marcarNovidadesVistasPlanejador = () => apiPost("/crm/novidades/marcar-vistas", {})
