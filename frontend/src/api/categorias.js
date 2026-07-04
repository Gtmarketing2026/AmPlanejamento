import { apiGet } from "./client"

export const listarCategorias = () => apiGet("/categorias")

export const listarSubcategorias = () => apiGet("/subcategorias")
