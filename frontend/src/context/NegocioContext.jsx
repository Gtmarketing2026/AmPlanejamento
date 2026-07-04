import { createContext, useCallback, useContext, useState } from "react"
import { useNavigate } from "react-router-dom"

// Guarda o contexto de navegação do admin: qual planejador e qual cliente ele
// está "visualizando" no momento (a barra de contexto Negócio → Planejador →
// Cliente do wireframe). Setar o contexto também navega — mantém a URL e a
// barra sempre em sincronia.
const NegocioContext = createContext(null)

export function NegocioProvider({ children }) {
  const navigate = useNavigate()
  const [planejador, setPlanejador] = useState(null) // { id, nome } | null
  const [cliente, setCliente] = useState(null) // { id, nome } | null

  const entrarPlanejador = useCallback(
    (p) => {
      setPlanejador(p)
      setCliente(null)
      navigate(`/negocio/planejadores/${p.id}`)
    },
    [navigate]
  )

  const entrarCliente = useCallback(
    (c) => {
      setCliente(c)
      navigate(`/negocio/clientes/${c.id}`)
    },
    [navigate]
  )

  const voltarNegocio = useCallback(() => {
    setPlanejador(null)
    setCliente(null)
    navigate("/negocio")
  }, [navigate])

  // Backfill silencioso quando o admin abre um link direto (refresh numa rota
  // profunda): a página carrega o dado e sincroniza o contexto sem navegar.
  const sincronizarPlanejador = useCallback((p) => setPlanejador(p), [])
  const sincronizarCliente = useCallback((c) => setCliente(c), [])

  return (
    <NegocioContext.Provider
      value={{
        planejador,
        cliente,
        entrarPlanejador,
        entrarCliente,
        voltarNegocio,
        sincronizarPlanejador,
        sincronizarCliente,
      }}
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
