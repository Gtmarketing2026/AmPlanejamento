import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  atualizarStatusProfissional,
  concederTrial,
  listarClientesDoProfissional,
  listarProfissionais,
} from "../api/admin"

export function useAdminProfissionais() {
  return useQuery({ queryKey: ["admin", "profissionais"], queryFn: listarProfissionais })
}

export function useAdminClientesDoProfissional(id) {
  return useQuery({
    queryKey: ["admin", "profissionais", id, "clientes"],
    queryFn: () => listarClientesDoProfissional(id),
    enabled: !!id,
  })
}

export function useAtualizarStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => atualizarStatusProfissional(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "profissionais"] }),
  })
}

export function useConcederTrial() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, trial_ate }) => concederTrial(id, trial_ate),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "profissionais"] }),
  })
}
