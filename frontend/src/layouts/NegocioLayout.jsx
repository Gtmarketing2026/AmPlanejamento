import { useEffect } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { NegocioProvider } from "../context/NegocioContext"
import ContextBar from "../components/negocio/ContextBar"
import { getTokenAdmin, setTokenAdmin } from "../api/negocio"
import { setToken } from "../api/client"
import { setTokenCliente } from "../pages/clienteFinal/ClienteLoginPage"
import { getImpersonacao, encerrarImpersonacao } from "../lib/impersonacao"
import Logo from "../components/ui/Logo"

const NAV = [
  { to: "/negocio", label: "Painel do Negócio", end: true },
  { to: "/negocio/planejadores", label: "Planejadores", end: false },
  { to: "/negocio/financeiro", label: "Financeiro da Plataforma", end: false },
  { to: "/negocio/novidades", label: "Novidades", end: false },
]

export default function NegocioLayout() {
  const navigate = useNavigate()

  // Guard de sessão: sem token de admin, ou num 401 vindo de qualquer chamada
  // /negocio/*, volta pro login do Negócio (nunca cai na tela do profissional).
  useEffect(() => {
    if (!getTokenAdmin()) {
      navigate("/negocio/login", { replace: true })
      return
    }
    const onUnauthorized = () => navigate("/negocio/login", { replace: true })
    window.addEventListener("fluxo:negocio-unauthorized", onUnauthorized)
    return () => window.removeEventListener("fluxo:negocio-unauthorized", onUnauthorized)
  }, [navigate])

  // Limpeza do token impersonado (planejador/cliente): feita AQUI, só depois
  // que já aterrissamos de verdade nessa tela -- se limpasse no clique do
  // botão "Voltar" (antes da navegação terminar), o ProtectedRoute ainda
  // montado reagiria ao perfil virando null e competiria com a navegação.
  useEffect(() => {
    if (getImpersonacao()) {
      encerrarImpersonacao()
      setToken(null)
      setTokenCliente(null)
    }
  }, [])

  function sair() {
    setTokenAdmin(null)
    navigate("/negocio/login", { replace: true })
  }

  const linkClasse = ({ isActive }) =>
    `px-3.5 py-2 rounded-[9px] text-[13px] font-medium transition-colors ${
      isActive ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
    }`

  return (
    <NegocioProvider>
      <div className="min-h-screen bg-bg text-text">
        <div className="sticky top-0 z-40 bg-bg/92 backdrop-blur border-b border-line">
          <div className="max-w-[1360px] mx-auto px-8 py-3 flex items-center gap-4">
            <Logo sub="nível Negócio · admin" />
            <nav className="flex items-center gap-1 ml-4">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={linkClasse}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <NavLink to="/negocio/perfil" className={linkClasse}>
                Minha conta
              </NavLink>
              <button
                onClick={sair}
                className="px-3 py-2 rounded-[7px] text-[12.5px] text-text-faint hover:text-text-dim"
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        <ContextBar />

        <Outlet />
      </div>
    </NegocioProvider>
  )
}
