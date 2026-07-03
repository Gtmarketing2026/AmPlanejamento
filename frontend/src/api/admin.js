import { apiGet, apiPatch } from "./client"

export const listarProfissionais = () => apiGet("/admin/profissionais")

export const listarClientesDoProfissional = (id) => apiGet(`/admin/profissionais/${id}/clientes`)

export const atualizarStatusProfissional = (id, status) =>
  apiPatch(`/admin/profissionais/${id}/status`, { status })

export const concederTrial = (id, trial_ate) => apiPatch(`/admin/profissionais/${id}/trial`, { trial_ate })

export const buscarMetricas = () => apiGet("/admin/metricas")

export const buscarSerieTemporal = () => apiGet("/admin/metricas/serie-temporal")
