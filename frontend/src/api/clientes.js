import { apiDelete, apiGet, apiPost } from "./client"

export const listarClientes = () => apiGet("/clientes")

export const criarCliente = (dados) => apiPost("/clientes", dados)

export const excluirCliente = (id, dados) => apiDelete(`/clientes/${id}`, dados)

export const loginCliente = (nickname, senha) =>
  apiPost("/clientes/login", { nickname, senha }, { auth: false })

export const meuPerfilCliente = (token) => apiGet("/clientes/eu", { token })
