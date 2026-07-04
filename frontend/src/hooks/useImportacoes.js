import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { criarImportacao, excluirImportacao, listarImportacoes, listarTransacoes } from "../api/importacoes"

export function useImportacoes(clienteId) {
  return useQuery({
    queryKey: ["importacoes", clienteId],
    queryFn: () => listarImportacoes(clienteId),
    enabled: !!clienteId,
  })
}

export function useTransacoesCliente(clienteId) {
  return useQuery({
    queryKey: ["transacoes", clienteId],
    queryFn: () => listarTransacoes(clienteId),
    enabled: !!clienteId,
  })
}

export function useCriarImportacao(clienteId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: criarImportacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["importacoes", clienteId] })
      qc.invalidateQueries({ queryKey: ["transacoes", clienteId] })
    },
  })
}

export function useExcluirImportacao(clienteId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: excluirImportacao,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["importacoes", clienteId] })
      qc.invalidateQueries({ queryKey: ["transacoes", clienteId] })
    },
  })
}
