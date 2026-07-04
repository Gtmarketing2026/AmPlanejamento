import { apiDelete, apiGet } from "./client"

const BASE_URL = import.meta.env.VITE_API_BASE_URL

function getToken() {
  return localStorage.getItem("fluxo_token")
}

export async function criarImportacao({ clienteId, tipoDocumento, periodoInicio, periodoFim, arquivo }) {
  const form = new FormData()
  form.append("cliente_id", clienteId)
  form.append("tipo_documento", tipoDocumento)
  if (periodoInicio) form.append("periodo_inicio", periodoInicio)
  if (periodoFim) form.append("periodo_fim", periodoFim)
  form.append("arquivo", arquivo)

  const res = await fetch(`${BASE_URL}/importacoes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail || `Erro ${res.status}`)
  return data
}

export const listarImportacoes = (clienteId) => apiGet(`/importacoes?cliente_id=${clienteId}`)

export const excluirImportacao = (id) => apiDelete(`/importacoes/${id}`)

export const listarTransacoes = (clienteId) => apiGet(`/transacoes?cliente_id=${clienteId}`)
