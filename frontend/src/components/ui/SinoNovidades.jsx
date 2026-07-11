import { useState } from "react"
import { createPortal } from "react-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatarData } from "../../lib/format"

// Badge por tipo de nota (novidade / melhoria / correção).
const TIPO_INFO = {
  novidade: { rotulo: "Novidade", cor: "#26D9A8" },
  melhoria: { rotulo: "Melhoria", cor: "#4C8DFF" },
  correcao: { rotulo: "Correção", cor: "#F0A63C" },
}

// Sino de "Novidades do sistema" (changelog). Genérico: recebe as funções de
// carregar/marcar-vistas e a chave de cache -- serve pro cliente e pro planejador.
export default function SinoNovidades({ queryKey, carregar, marcarVistas, enabled = true }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)

  const { data } = useQuery({
    queryKey,
    queryFn: carregar,
    enabled,
    refetchInterval: 120000,
  })
  const marcar = useMutation({
    mutationFn: marcarVistas,
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const itens = data?.itens || []
  const naoLidas = data?.nao_lidas || 0

  function abrir() {
    const vai = !aberto
    setAberto(vai)
    if (vai && naoLidas > 0) marcar.mutate() // ao abrir, marca como visto
  }

  return (
    <div className="relative">
      <button
        onClick={abrir}
        className="relative w-9 h-9 rounded-[8px] border border-line bg-panel flex items-center justify-center text-text-dim hover:text-text"
        title="Novidades do sistema"
      >
        <span className="text-[15px]">📣</span>
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[#062019] text-[10px] font-mono flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <>
          {createPortal(
            <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />,
            document.body
          )}
          <div className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-y-auto bg-panel border border-line rounded-[12px] shadow-xl z-50 p-3">
            <div className="text-[12px] font-semibold mb-2 px-1">Novidades do sistema</div>
            {!itens.length && (
              <p className="text-text-faint text-[12px] text-center py-6">
                Nada por aqui ainda — atualizações e melhorias do sistema aparecem aqui.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {itens.slice(0, 40).map((n) => {
                const info = TIPO_INFO[n.tipo] || TIPO_INFO.novidade
                return (
                  <div
                    key={n.id}
                    className={`rounded-[9px] px-3 py-2.5 border ${n.nao_lida ? "border-accent/40 bg-panel-2" : "border-line"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: `${info.cor}22`, color: info.cor }}
                        >
                          {info.rotulo}
                        </span>
                        <span className="text-[13px] font-medium truncate">{n.titulo}</span>
                      </div>
                      {n.publicado_em && (
                        <span className="text-text-faint text-[10.5px] font-mono whitespace-nowrap">
                          {formatarData(n.publicado_em)}
                        </span>
                      )}
                    </div>
                    <div className="text-text-dim text-[12px] whitespace-pre-line">{n.descricao}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
