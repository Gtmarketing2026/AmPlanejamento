import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function AdminRoute() {
  const { profissional, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-text-dim">Carregando…</div>
  }

  if (!profissional?.is_admin) {
    return <Navigate to="/clientes" replace />
  }

  return <Outlet />
}
