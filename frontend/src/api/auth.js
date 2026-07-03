import { apiGet, apiPost } from "./client"

export const login = (email, senha) => apiPost("/auth/login", { email, senha }, { auth: false })

export const cadastrar = (nome, email, senha, subdominio) =>
  apiPost("/auth/cadastro", { nome, email, senha, subdominio }, { auth: false })

export const meuPerfil = () => apiGet("/auth/me")
