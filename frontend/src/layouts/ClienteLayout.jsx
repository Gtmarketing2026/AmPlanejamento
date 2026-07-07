import { useEffect } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import BannerImpersonacao from "../components/negocio/BannerImpersonacao"
import SinoNotificacoes from "../components/cliente/SinoNotificacoes"
import MenuConfiguracoes from "../components/cliente/MenuConfiguracoes"
import { meuPerfilCliente } from "../api/clientes"
import { ApiError } from "../api/client"
import { getImpersonacao } from "../lib/impersonacao"
import { getTokenCliente, setTokenCliente } from "../pages/clienteFinal/ClienteLoginPage"

const linkClasse = ({ isActive }) =>
  `px-3.5 py-2 rounded-[7px] text-[12.5px] font-semibold transition-colors ${
    isActive ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
  }`

export default function ClienteLayout() {
  const navigate = useNavigate()
  const token = getTokenCliente()
  const impersonando = getImpersonacao() === "cliente"

  const { data: perfil, error } = useQuery({
    queryKey: ["cliente-eu", token],
    queryFn: () => meuPerfilCliente(token),
    enabled: !!token,
    retry: false,
  })

  useEffect(() => {
    if (!token || (error instanceof ApiError && error.status === 401)) {
      setTokenCliente(null)
      navigate("/cliente/login")
    }
  }, [token, error, navigate])

  function sair() {
    setTokenCliente(null)
    navigate("/cliente/login")
  }

  if (!token || !perfil) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-text-dim">Carregando…</div>
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      {impersonando && <BannerImpersonacao nome={perfil.nome} />}
      <div className="sticky top-0 z-40 bg-bg/92 backdrop-blur border-b border-line px-8 py-3.5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[15px] font-semibold">Olá, {perfil.nome.split(" ")[0]}</div>
          <div className="text-[11px] text-text-faint font-mono">
            você acompanha seu planejamento e pode ajustar categorias/importar extratos
          </div>
        </div>
        <div className="flex items-center gap-1 bg-panel border border-line rounded-[10px] p-1">
          <NavLink to="/cliente/dashboard" className={linkClasse}>Meu painel</NavLink>
          <NavLink to="/cliente/importar" className={linkClasse}>Importar extrato</NavLink>
        </div>
        <div className="flex items-center gap-2">
          <SinoNotificacoes token={token} />
          <MenuConfiguracoes token={token} />
          <button onClick={sair} className="px-3 py-2 rounded-[7px] text-[12.5px] text-text-faint hover:text-text-dim">
            Sair
          </button>
        </div>
      </div>

      <Outlet context={{ token, perfil }} />
    </div>
  )
}
