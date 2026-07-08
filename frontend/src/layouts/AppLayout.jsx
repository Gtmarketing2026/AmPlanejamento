import { Link, Outlet } from "react-router-dom"
import Topbar from "../components/layout/Topbar"
import BannerImpersonacao from "../components/negocio/BannerImpersonacao"
import { useAuth } from "../context/AuthContext"
import { getImpersonacao } from "../lib/impersonacao"

export default function AppLayout() {
  const { profissional } = useAuth()
  const impersonando = getImpersonacao() === "planejador"
  // Paywall: enquanto não tem plano ativo, o app fica visível mas as ações
  // estão travadas (o backend devolve 402). Banner fixo leva pra /assinatura.
  const semPlano = profissional && profissional.plano_ativo === false

  return (
    <div className="min-h-screen bg-bg text-text">
      {impersonando && <BannerImpersonacao nome={profissional?.nome || "planejador"} />}
      <Topbar />
      {semPlano && (
        <div className="bg-amber/10 border-b border-amber/30 px-8 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <span className="text-amber text-[12.5px]">
            ⚠️ Sua conta ainda não tem um plano ativo — você pode navegar, mas cadastrar clientes e usar o
            AMplanejador só depois de escolher e pagar um plano.
          </span>
          <Link
            to="/assinatura"
            className="px-3 py-1.5 rounded-[7px] bg-amber text-[#1a1200] text-[12px] font-semibold hover:brightness-110"
          >
            Escolher plano →
          </Link>
        </div>
      )}
      <Outlet />
    </div>
  )
}
