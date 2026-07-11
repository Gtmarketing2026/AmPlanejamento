import { useEffect, useRef } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query"
import BannerImpersonacao from "../components/negocio/BannerImpersonacao"
import SinoNotificacoes from "../components/cliente/SinoNotificacoes"
import SinoNovidades from "../components/ui/SinoNovidades"
import { obterMinhasNovidades, marcarNovidadesVistas } from "../api/patrimonio"
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
  const qc = useQueryClient()
  const token = getTokenCliente()
  const impersonando = getImpersonacao() === "cliente"

  const { data: perfil, error } = useQuery({
    queryKey: ["cliente-eu", token],
    queryFn: () => meuPerfilCliente(token),
    enabled: !!token,
    retry: false,
  })

  // A classificação por IA roda como mutation (key "classificar-ia") disparada
  // na aba Importar ou no botão "Reclassificar" dos Lançamentos. Rastreando-a
  // aqui no layout, o aviso aparece em TODAS as abas e sobrevive à navegação --
  // a mutation continua no cache do React Query mesmo se o componente que a
  // disparou for desmontado. Assim a pessoa não acha que "não classificou":
  // entende que ainda está em processo.
  const classificando = useIsMutating({ mutationKey: ["classificar-ia"] })
  const classificandoAntes = useRef(0)
  useEffect(() => {
    // Quando a classificação TERMINA (contador cai a 0), recarrega lançamentos
    // e importações -- garante que as categorias recém-atribuídas apareçam
    // mesmo que a pessoa tenha trocado de aba (nesse caso o onSuccess da
    // mutation original não roda, porque o componente já desmontou).
    if (classificandoAntes.current > 0 && classificando === 0) {
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes"] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes"] })
    }
    classificandoAntes.current = classificando
  }, [classificando, qc])

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
      {/* Header + aviso da IA no MESMO container sticky: o aviso fica sempre
          colado abaixo do menu, sem depender da altura exata do header. */}
      <div className="sticky top-0 z-40">
        <div className="bg-bg/92 backdrop-blur border-b border-line px-8 py-3.5 flex items-center justify-between flex-wrap gap-3">
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
            <SinoNovidades
              queryKey={["cliente-eu-novidades", token]}
              carregar={() => obterMinhasNovidades(token)}
              marcarVistas={() => marcarNovidadesVistas(token)}
              enabled={!!token}
            />
            <SinoNotificacoes token={token} />
            <MenuConfiguracoes token={token} />
            <button onClick={sair} className="px-3 py-2 rounded-[7px] text-[12.5px] text-text-faint hover:text-text-dim">
              Sair
            </button>
          </div>
        </div>
        {classificando > 0 && (
          <div className="bg-accent/12 backdrop-blur border-b border-accent/30 px-8 py-2.5 flex items-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-accent/40 border-t-accent animate-spin shrink-0" />
            <p className="text-[12.5px] text-text leading-snug">
              <strong className="text-accent">A IA ainda está classificando seus lançamentos.</strong>{" "}
              Aguarde um instante — as categorias vão aparecer sozinhas quando terminar. Pode continuar
              navegando normalmente.
            </p>
          </div>
        )}
      </div>

      <Outlet context={{ token, perfil }} />
    </div>
  )
}
