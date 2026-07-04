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

export const minhasTransacoes = (token) => apiGet("/clientes/eu/transacoes", { token })

export const atualizarMinhaTransacao = (token, id, dados) =>
  apiPatch(`/clientes/eu/transacoes/${id}`, dados, { token })
