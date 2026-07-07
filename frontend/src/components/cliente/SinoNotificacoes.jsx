import { useState } from "react"
import { createPortal } from "react-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  listarMinhasNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "../../api/patrimonio"
import { formatarData } from "../../lib/format"

// Sino de notificações do topo (substitui a antiga aba "Notificações").
// Mostra a contagem de não lidas e, ao clicar, abre um painel com os avisos.
export default function SinoNotificacoes({ token }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)

  const { data: notificacoes = [] } = useQuery({
    queryKey: ["cliente-eu-notificacoes", token],
    queryFn: () => listarMinhasNotificacoes(token),
    enabled: !!token,
    refetchInterval: 60000,
  })

  const marcarLida = useMutation({
    mutationFn: (id) => marcarNotificacaoLida(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-notificacoes", token] }),
  })
  const marcarTodas = useMutation({
    mutationFn: () => marcarTodasNotificacoesLidas(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-notificacoes", token] }),
  })

  const naoLidas = notificacoes.filter((n) => !n.lida_cliente).length

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative w-9 h-9 rounded-[8px] border border-line bg-panel flex items-center justify-center text-text-dim hover:text-text"
        title="Notificações"
      >
        <span className="text-[15px]">🔔</span>
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[10px] font-mono flex items-center justify-center">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <>
          {/* Portal pro <body>: a barra do topo usa backdrop-blur, que vira o
          "containing block" de elementos position:fixed -- sem o portal, esse
          catcher de clique-fora ficava confinado à faixa estreita da barra. */}
          {createPortal(
            <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />,
            document.body
          )}
          <div className="absolute right-0 mt-2 w-[340px] max-h-[70vh] overflow-y-auto bg-panel border border-line rounded-[12px] shadow-xl z-50 p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-[12px] font-semibold">Notificações</div>
              {naoLidas > 0 && (
                <button
                  onClick={() => marcarTodas.mutate()}
                  className="text-accent text-[11.5px] hover:underline"
                  disabled={marcarTodas.isPending}
                >
                  Marcar todas lidas
                </button>
              )}
            </div>

            {!notificacoes.length && (
              <p className="text-text-faint text-[12px] text-center py-6">
                Nenhuma notificação — avisos do sistema e mensagens do seu planejador aparecem aqui.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              {notificacoes.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  className={`rounded-[9px] px-3 py-2.5 border ${
                    n.lida_cliente ? "border-line" : "border-accent/40 bg-panel-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-medium">{n.titulo}</div>
                    <span className="text-text-faint text-[10.5px] font-mono whitespace-nowrap">
                      {formatarData(n.criado_em)}
                    </span>
                  </div>
                  <div className="text-text-dim text-[12px] mt-0.5 whitespace-pre-line">{n.mensagem}</div>
                  {!n.lida_cliente && (
                    <button
                      onClick={() => marcarLida.mutate(n.id)}
                      className="text-text-faint hover:text-accent text-[11px] mt-1"
                    >
                      Marcar lida
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
