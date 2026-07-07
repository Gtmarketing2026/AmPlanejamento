import { useEffect, useState } from "react"

// Menu de dois níveis: uma linha de grupos e, abaixo, os itens do grupo
// aberto. Enxuga a navegação do painel do cliente (que tinha ~14 abas numa
// fileira só) agrupando assuntos parecidos. Controlado por `active`/`onChange`,
// igual ao Tabs simples.
export default function TabsAgrupadas({ grupos, active, onChange }) {
  const grupoDoAtivo = grupos.findIndex((g) => g.itens.some((i) => i.value === active))
  const [aberto, setAberto] = useState(grupoDoAtivo >= 0 ? grupoDoAtivo : 0)

  useEffect(() => {
    if (grupoDoAtivo >= 0) setAberto(grupoDoAtivo)
  }, [grupoDoAtivo])

  const itens = grupos[aberto]?.itens ?? []

  return (
    <div className="flex flex-col gap-2">
      <div className="inline-flex flex-wrap gap-1 bg-panel border border-line rounded-[10px] p-1 w-fit">
        {grupos.map((g, idx) => {
          const badge = g.itens.reduce((s, i) => s + (i.badge || 0), 0)
          const ativo = idx === aberto
          const contemAtivo = idx === grupoDoAtivo
          return (
            <button
              key={g.label}
              onClick={() => setAberto(idx)}
              className={`px-3.5 py-2 rounded-[7px] text-[12.5px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                ativo ? "bg-panel-2 text-text" : "text-text-dim hover:text-text"
              } ${contemAtivo && !ativo ? "text-text" : ""}`}
            >
              {g.label}
              {contemAtivo && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
              {badge > 0 && (
                <span className="text-[10px] font-mono rounded-full px-1.5 py-0.5 leading-none bg-red/20 text-red">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="inline-flex flex-wrap gap-1 w-fit">
        {itens.map((i) => (
          <button
            key={i.value}
            onClick={() => onChange(i.value)}
            className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              active === i.value ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text hover:bg-panel"
            }`}
          >
            {i.label}
            {!!i.badge && (
              <span
                className={`text-[10px] font-mono rounded-full px-1.5 py-0.5 leading-none ${
                  active === i.value ? "bg-[#062019]/20 text-[#062019]" : "bg-red/20 text-red"
                }`}
              >
                {i.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
