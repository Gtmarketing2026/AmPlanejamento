import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Pill from "../../../components/ui/Pill"
import {
  listarMinhasNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "../../../api/patrimonio"
import { formatarData } from "../../../lib/format"

const TIPOS = {
  gasto_acima_categoria: { label: "Gasto acima do esperado", variant: "warn" },
  meta_atingida: { label: "Meta atingida", variant: "on" },
  meta_em_risco: { label: "Meta em risco", variant: "warn" },
  fatura_proxima_vencimento: { label: "Fatura", variant: "warn" },
  divida_proxima_vencimento: { label: "Dívida", variant: "off" },
  conexao_desatualizada: { label: "Conexão", variant: "neutral" },
  consentimento_expirando: { label: "Consentimento", variant: "neutral" },
  outro: { label: "Aviso", variant: "neutral" },
}

export default function NotificacoesTab({ token }) {
  const qc = useQueryClient()

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-notificacoes", token],
    queryFn: () => listarMinhasNotificacoes(token),
    enabled: !!token,
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

  if (isLoading) return <p className="text-text-faint text-sm">Carregando…</p>

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            Notificações {naoLidas > 0 && <span className="text-accent">({naoLidas} não lidas)</span>}
          </div>
          {naoLidas > 0 && (
            <Button variant="ghost" onClick={() => marcarTodas.mutate()} disabled={marcarTodas.isPending}>
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {!notificacoes.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            Nenhuma notificação ainda — avisos do sistema e mensagens do seu planejador aparecem aqui.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {notificacoes.map((n) => {
            const meta = TIPOS[n.tipo] || TIPOS.outro
            return (
              <div
                key={n.id}
                className={`flex gap-3 border rounded-[9px] px-3.5 py-3 ${
                  n.lida_cliente ? "border-line" : "border-accent/40 bg-panel-2"
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Pill variant={meta.variant}>{meta.label}</Pill>
                    <span className="text-text-faint text-[11px] font-mono">{formatarData(n.criado_em)}</span>
                  </div>
                  <div className="text-[13.5px] font-medium">{n.titulo}</div>
                  <div className="text-text-dim text-[12.5px] mt-0.5 whitespace-pre-line">{n.mensagem}</div>
                </div>
                {!n.lida_cliente && (
                  <button
                    onClick={() => marcarLida.mutate(n.id)}
                    className="text-text-faint hover:text-accent text-[11.5px] self-start whitespace-nowrap"
                  >
                    Marcar lida
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
