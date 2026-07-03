import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { criarCliente, excluirCliente, listarClientes } from "../api/clientes"

export function useClientes() {
  return useQuery({ queryKey: ["clientes"], queryFn: listarClientes })
}

export function useCriarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: criarCliente,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  })
}

export function useExcluirCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dados }) => excluirCliente(id, dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clientes"] }),
  })
}
