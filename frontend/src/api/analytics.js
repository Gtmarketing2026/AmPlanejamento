import { apiGet } from "./client"

export const metricasCarteira = () => apiGet("/metricas-carteira")
