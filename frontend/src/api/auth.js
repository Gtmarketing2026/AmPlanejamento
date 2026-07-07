import { apiGet, apiPost } from "./client"

export const login = (email, senha) => apiPost("/auth/login", { email, senha }, { auth: false })

export const cadastrar = (nome, email, senha, extras = {}) =>
  apiPost("/auth/cadastro", { nome, email, senha, ...extras }, { auth: false })

export const meuPerfil = () => apiGet("/auth/me")
