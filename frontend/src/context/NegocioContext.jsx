import { createContext, useCallback, useContext, useState } from "react"
import { useNavigate } from "react-router-dom"

// Guarda só qual planejador o admin está "navegando" (pra breadcrumb da
// ContextBar) enquanto ele browsa a lista de clientes -- não confundir com
// "entrar como" (useEntrarComo), que emite token real e leva pra SPA de
// verdade do planejador/cliente. Isso aqui é só pra Carteira do planejador
// (visão administrativa da lista de clientes dele).
const NegocioContext = createContext(null)

export function NegocioProvider({ children }) {
  const navigate = useNavigate()
  const [planejador, setPlanejador] = useState(null) // { id, nome } | null

  const verCarteiraDoPlanejador = useCallback(
    (p) => {
      setPlanejador(p)
      navigate(`/negocio/planejadores/${p.id}`)
    },
    [navigate]
  )

  const voltarNegocio = useCallback(() => {
    setPlanejador(null)
    navigate("/negocio")
  }, [navigate])

  // Backfill silencioso quando o admin abre um link direto (refresh numa rota
  // profunda): a página carrega o dado e sincroniza o contexto sem navegar.
  const sincronizarPlanejador = useCallback((p) => setPlanejador(p), [])

  return (
    <NegocioContext.Provider
      value={{ planejador, verCarteiraDoPlanejador, voltarNegocio, sincronizarPlanejador }}
    >
      {children}
    </NegocioContext.Provider>
  )
}

export function useNegocio() {
  const ctx = useContext(NegocioContext)
  if (!ctx) throw new Error("useNegocio precisa estar dentro de NegocioProvider")
  return ctx
}
