import { useEffect } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { NegocioProvider } from "../context/NegocioContext"
import ContextBar from "../components/negocio/ContextBar"
import { getTokenAdmin, setTokenAdmin } from "../api/negocio"

const NAV = [
  { to: "/negocio", label: "Painel do Negócio", end: true },
  { to: "/negocio/planejadores", label: "Planejadores", end: false },
  { to: "/negocio/financeiro", label: "Financeiro da Plataforma", end: false },
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
            <div className="flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-accent to-blue relative">
                <div className="absolute inset-[7px] rounded-[3px] bg-bg" />
              </div>
              <div>
                <div className="text-[14px] font-semibold leading-none">Fluxo</div>
                <div className="text-[10px] text-text-faint font-mono mt-0.5">nível Negócio · admin</div>
              </div>
            </div>
            <nav className="flex items-center gap-1 ml-4">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={linkClasse}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={sair}
              className="ml-auto px-3 py-2 rounded-[7px] text-[12.5px] text-text-faint hover:text-text-dim"
            >
              Sair
            </button>
          </div>
        </div>

        <ContextBar />

        <Outlet />
      </div>
    </NegocioProvider>
  )
}
