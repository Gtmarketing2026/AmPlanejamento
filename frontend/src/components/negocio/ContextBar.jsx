import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNegocio } from "../../context/NegocioContext"
import { useEntrarComo } from "../../hooks/useEntrarComo"
import { listarClientesDoPlanejador, listarPlanejadores } from "../../api/negocio"

function CrumbButton({ children, onClick, locked }) {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] border border-line bg-panel-2 ${
        locked ? "text-text-faint cursor-default" : "text-text-dim hover:text-text hover:border-text-faint"
      }`}
    >
      {children}
    </button>
  )
}

function Dropdown({ itens, onEscolher, vazio }) {
  return (
    <div className="absolute z-50 mt-1 min-w-[220px] max-h-[280px] overflow-auto bg-panel border border-line rounded-[9px] shadow-xl py-1">
      {itens.length === 0 && <div className="px-3 py-2 text-[12px] text-text-faint">{vazio}</div>}
      {itens.map((it) => (
        <button
          key={it.id}
          onClick={() => onEscolher(it)}
          className="block w-full text-left px-3 py-2 text-[12.5px] text-text-dim hover:bg-panel-2 hover:text-text"
        >
          {it.nome}
        </button>
      ))}
    </div>
  )
}

export default function ContextBar() {
  const { planejador, verCarteiraDoPlanejador, voltarNegocio } = useNegocio()
  const { entrarCliente } = useEntrarComo()
  const [aberto, setAberto] = useState(null) // 'planejador' | 'cliente' | null

  const { data: planejadores = [] } = useQuery({
    queryKey: ["negocio-planejadores"],
    queryFn: listarPlanejadores,
  })
  const { data: clientes = [] } = useQuery({
    queryKey: ["negocio-clientes", planejador?.id],
    queryFn: () => listarClientesDoPlanejador(planejador.id),
    enabled: !!planejador,
  })

  function toggle(qual) {
    setAberto((a) => (a === qual ? null : qual))
  }

  return (
    <div className="border-b border-line bg-bg/80 backdrop-blur">
      <div className="max-w-[1360px] mx-auto px-8 py-3 flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] text-text-faint mr-1">Visualizando:</span>

        <CrumbButton onClick={voltarNegocio}>🏢 Negócio</CrumbButton>

        <span className="text-text-faint">→</span>

        <div className="relative">
          <CrumbButton onClick={() => toggle("planejador")}>
            {planejador ? `🧑‍💼 ${planejador.nome}` : "Selecionar planejador"} ▾
          </CrumbButton>
          {aberto === "planejador" && (
            <Dropdown
              itens={planejadores}
              vazio="Nenhum planejador ainda."
              onEscolher={(p) => {
                setAberto(null)
                verCarteiraDoPlanejador({ id: p.id, nome: p.nome })
              }}
            />
          )}
        </div>

        {planejador && (
          <>
            <span className="text-text-faint">→</span>
            <div className="relative">
              <CrumbButton onClick={() => toggle("cliente")}>Selecionar cliente ▾</CrumbButton>
              {aberto === "cliente" && (
                <Dropdown
                  itens={clientes}
                  vazio="Esse planejador não tem clientes."
                  onEscolher={(c) => {
                    setAberto(null)
                    entrarCliente(c.id)
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
