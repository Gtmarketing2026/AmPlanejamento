import { apiDelete, apiGet, apiPatch, apiPost } from "./client"

// ---------- Categorias/subcategorias compartilhadas do escritório (planejador) ----------
export const listarCategorias = () => apiGet("/categorias")
export const criarCategoria = (dados) => apiPost("/categorias", dados)
export const atualizarCategoria = (id, dados) => apiPatch(`/categorias/${id}`, dados)
export const excluirCategoria = (id) => apiDelete(`/categorias/${id}`)

export const listarSubcategorias = () => apiGet("/subcategorias")
export const criarSubcategoria = (dados) => apiPost("/subcategorias", dados)
export const atualizarSubcategoria = (id, dados) => apiPatch(`/subcategorias/${id}`, dados)
export const excluirSubcategoria = (id) => apiDelete(`/subcategorias/${id}`)
