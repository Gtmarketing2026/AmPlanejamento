import { Outlet } from "react-router-dom"
import Topbar from "../components/layout/Topbar"
import BannerImpersonacao from "../components/negocio/BannerImpersonacao"
import { PlanProvider } from "../context/PlanContext"
import { useAuth } from "../context/AuthContext"
import { getImpersonacao } from "../lib/impersonacao"

export default function AppLayout() {
  const { profissional } = useAuth()
  const impersonando = getImpersonacao() === "planejador"

  return (
    <PlanProvider>
      <div className="min-h-screen bg-bg text-text">
        {impersonando && <BannerImpersonacao nome={profissional?.nome || "planejador"} />}
        <Topbar />
        <Outlet />
      </div>
    </PlanProvider>
  )
}
