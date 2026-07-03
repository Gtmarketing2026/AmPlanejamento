import { apiGet } from "./client"

export const listarFaturas = () => apiGet("/faturas")
