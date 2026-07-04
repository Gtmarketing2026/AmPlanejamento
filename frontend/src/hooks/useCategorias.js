import { useQuery } from "@tanstack/react-query"
import { listarCategorias, listarSubcategorias } from "../api/categorias"

export function useCategorias() {
  return useQuery({ queryKey: ["categorias"], queryFn: listarCategorias })
}

export function useSubcategorias() {
  return useQuery({ queryKey: ["subcategorias"], queryFn: listarSubcategorias })
}
