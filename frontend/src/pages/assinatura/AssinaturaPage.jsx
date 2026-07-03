import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import { useFaturas } from "../../hooks/useFaturas"
import { formatarCiclo, formatarMoeda, statusFatura } from "../../lib/format"

export default function AssinaturaPage() {
  const { data: faturas, isLoading, error } = useFaturas()
  const atual = faturas?.[0]
  const s = atual ? statusFatura(atual.status) : null

  return (
    <Stage
      eyebrow="Etapa 05"
      title="Cobrança e status da assinatura"
      description="Congela em D+5 (pausa conexões Open Finance) e cancela em D+35 a partir da inadimplência. Reativação é automática ao pagar."
    >
      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {error && <p className="text-red text-sm">Não foi possível carregar a assinatura.</p>}

      {!isLoading && !error && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
              {atual ? `Fatura de ${formatarCiclo(atual.ciclo_referencia)}` : "Sem fatura ainda"}
            </div>
            {atual ? (
              <>
                <div className="flex justify-between py-2 border-b border-line text-[13px]">
                  <span className="text-text-dim">Plano base</span>
                  <span className="font-mono">{formatarMoeda(atual.valor_base)}</span>
                </div>
                {atual.clientes_extras_no_ciclo > 0 && (
                  <div className="flex justify-between py-2 border-b border-line text-[13px]">
                    <span className="text-text-dim">Clientes extras — {atual.clientes_extras_no_ciclo}×</span>
                    <span className="font-mono">{formatarMoeda(atual.valor_extras)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2.5 text-[14px] font-semibold">
                  <span>Total</span>
                  <span className="font-mono text-accent">{formatarMoeda(atual.valor_total)}</span>
                </div>
              </>
            ) : (
              <p className="text-text-faint text-sm">
                Nenhuma fatura foi gerada ainda — o job de faturamento roda por ciclo.
              </p>
            )}
          </Card>

          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
              Status da assinatura
            </div>
            {s && <Pill variant={s.variant} pulse={s.variant === "off"}>{s.label}</Pill>}
            <div className="mt-5 space-y-2.5 text-[12.5px] text-text-dim leading-relaxed">
              <p>
                <strong className="text-text">Dia 5</strong> — congela acesso e pausa conexões Open
                Finance dos clientes
              </p>
              <p>
                <strong className="text-text">Dia 35</strong> — cancelamento definitivo da assinatura
              </p>
              <p>
                <strong className="text-accent">Ao pagar</strong> — reativação automática + reconexão
              </p>
            </div>
          </Card>
        </div>
      )}
    </Stage>
  )
}
