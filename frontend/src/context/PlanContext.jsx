import { createContext, useContext, useState } from "react"

const PlanContext = createContext(null)

export function PlanProvider({ children }) {
  const [plano, setPlano] = useState("completo") // 'essencial' | 'completo' — toggle de demonstração

  return <PlanContext.Provider value={{ plano, setPlano }}>{children}</PlanContext.Provider>
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error("usePlan precisa estar dentro de PlanProvider")
  return ctx
}
