import { useQuery } from "@tanstack/react-query"
import { buscarMetricas, buscarSerieTemporal } from "../api/admin"

export function useAdminMetricas() {
  return useQuery({ queryKey: ["admin", "metricas"], queryFn: buscarMetricas })
}

export function useAdminSerieTemporal() {
  return useQuery({ queryKey: ["admin", "serie-temporal"], queryFn: buscarSerieTemporal })
}
