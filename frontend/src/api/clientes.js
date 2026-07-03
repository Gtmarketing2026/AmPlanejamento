import { apiDelete, apiGet, apiPost } from "./client"

export const listarClientes = () => apiGet("/clientes")

export const criarCliente = (dados) => apiPost("/clientes", dados)

export const excluirCliente = (id, dados) => apiDelete(`/clientes/${id}`, dados)
