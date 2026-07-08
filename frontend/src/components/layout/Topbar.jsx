import { NavLink } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import Logo from "../ui/Logo"

const tabClass = ({ isActive }) =>
  `px-3.5 py-2 rounded-[7px] text-[12.5px] font-semibold transition-colors ${
    isActive ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
  }`

export default function Topbar() {
  const { profissional, sair } = useAuth()
  const podeMarca = !!profissional?.pode_editar_marca

  return (
    <div className="sticky top-0 z-40 bg-bg/92 backdrop-blur border-b border-line px-8 py-[18px] flex items-center justify-between flex-wrap gap-3.5">
      <Logo />

      <div className="flex items-center gap-1 bg-panel border border-line rounded-[10px] p-1 flex-wrap">
        <NavLink to="/inicio" className={tabClass}>Início</NavLink>
        <NavLink to="/clientes" className={tabClass}>Clientes</NavLink>
        <NavLink to="/crm" className={tabClass}>CRM</NavLink>
        <NavLink to="/painel-analitico" className={tabClass}>Painel Analítico</NavLink>
        {podeMarca && <NavLink to="/marca" className={tabClass}>Marca</NavLink>}
      </div>

      <div className="flex items-center gap-2">
        <NavLink
          to="/assinatura"
          className="px-3.5 py-2 rounded-[7px] text-[12.5px] font-semibold bg-panel-2 border border-line text-text-dim hover:text-text flex items-center gap-1.5"
        >
          💳 Assinatura
        </NavLink>
        <button
          onClick={sair}
          className="px-3 py-2 rounded-[7px] text-[12.5px] text-text-faint hover:text-text-dim"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
