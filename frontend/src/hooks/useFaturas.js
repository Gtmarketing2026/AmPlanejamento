import { useQuery } from "@tanstack/react-query"
import { listarFaturas } from "../api/faturas"

export function useFaturas() {
  return useQuery({ queryKey: ["faturas"], queryFn: listarFaturas })
}
