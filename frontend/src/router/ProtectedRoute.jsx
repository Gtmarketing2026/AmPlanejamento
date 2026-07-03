import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function ProtectedRoute() {
  const { autenticado, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-text-dim">Carregando…</div>
  }

  if (!autenticado) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
