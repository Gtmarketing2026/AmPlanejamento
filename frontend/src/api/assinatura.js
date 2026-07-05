import { apiGet, apiPost } from "./client"

export const catalogoPlanos = () => apiGet("/assinatura/planos", { auth: false })

export const minhaAssinatura = () => apiGet("/assinatura/eu")

export const escolherPlano = (tipo_plano, cpf_cnpj) =>
  apiPost("/assinatura/escolher-plano", { tipo_plano, cpf_cnpj })
