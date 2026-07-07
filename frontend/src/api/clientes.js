import { apiDelete, apiGet, apiPatch, apiPost } from "./client"

export const listarClientes = () => apiGet("/clientes")

export const criarCliente = (dados) => apiPost("/clientes", dados)

export const atualizarCliente = (id, dados) => apiPatch(`/clientes/${id}`, dados)

export const excluirCliente = (id, dados) => apiDelete(`/clientes/${id}`, dados)

export const loginCliente = (nickname, senha) =>
  apiPost("/clientes/login", { nickname, senha }, { auth: false })

export const meuPerfilCliente = (token) => apiGet("/clientes/eu", { token })

export const minhasCategorias = (token) => apiGet("/clientes/eu/categorias", { token })

export const minhasSubcategorias = (token) => apiGet("/clientes/eu/subcategorias", { token })

export const minhasTransacoes = (token, filtros = {}) => {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([k, v]) => {
    if (v) params.set(k, v)
  })
  const qs = params.toString()
  return apiGet(`/clientes/eu/transacoes${qs ? `?${qs}` : ""}`, { token })
}

export const criarMinhaTransacao = (token, dados) => apiPost("/clientes/eu/transacoes", dados, { token })

export const atualizarMinhaTransacao = (token, id, dados) =>
  apiPatch(`/clientes/eu/transacoes/${id}`, dados, { token })

export const excluirMinhaTransacao = (token, id) =>
  apiDelete(`/clientes/eu/transacoes/${id}`, undefined, { token })

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function importarMeuExtrato(token, { tipoDocumento, senhaPdf, arquivo }) {
  const form = new FormData()
  form.append("tipo_documento", tipoDocumento)
  if (senhaPdf) form.append("senha_pdf", senhaPdf)
  form.append("arquivo", arquivo)
  const res = await fetch(`${BASE_URL}/clientes/eu/importacoes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.detail || `Erro ${res.status}`)
  return data
}

export const listarMinhasImportacoes = (token) => apiGet("/clientes/eu/importacoes", { token })

export const excluirMinhaImportacao = (token, id) =>
  apiDelete(`/clientes/eu/importacoes/${id}`, undefined, { token })
