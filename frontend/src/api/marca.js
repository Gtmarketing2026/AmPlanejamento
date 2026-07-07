import { apiPatch } from "./client"

export const atualizarMarca = (dados) => apiPatch("/marca", dados)
