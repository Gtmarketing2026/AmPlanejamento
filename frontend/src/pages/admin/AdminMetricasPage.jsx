import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import SvgLineChart from "../../components/ui/SvgLineChart"
import { useAdminMetricas, useAdminSerieTemporal } from "../../hooks/useAdminMetricas"
import { formatarCiclo, formatarMoeda } from "../../lib/format"

export default function AdminMetricasPage() {
  const { data: m, isLoading, error } = useAdminMetricas()
  const { data: serie } = useAdminSerieTemporal()

  if (isLoading) return <Stage eyebrow="Admin" title="Métricas do negócio"><p className="text-text-faint text-sm">Carregando…</p></Stage>
  if (error) return <Stage eyebrow="Admin" title="Métricas do negócio"><p className="text-red text-sm">Não foi possível carregar as métricas.</p></Stage>

  const cadastros = serie?.novos_profissionais_por_mes ?? []
  const receita = serie?.receita_paga_por_ciclo ?? []

  return (
    <Stage eyebrow="Admin" title="Métricas do negócio" description="Visão geral da plataforma — todos os profissionais, não um por vez.">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiStat label="Profissionais ativos" value={m.profissionais.ativa} delta={`${m.profissionais.total} no total`} />
        <KpiStat label="Congelados / cancelados" value={`${m.profissionais.congelada} / ${m.profissionais.cancelada}`} />
        <KpiStat label="Em período de teste" value={m.profissionais.em_trial} deltaColor="accent" />
        <KpiStat label="Clientes ativos na plataforma" value={m.clientes_ativos_total} />
        <KpiStat
          label="Planos vendidos"
          value={m.planos_vendidos.total}
          delta={`${m.planos_vendidos.essencial} essencial · ${m.planos_vendidos.completo} completo`}
        />
        <KpiStat label="Total pago (histórico)" value={formatarMoeda(m.faturamento.total_pago_historico)} deltaColor="accent" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Novos profissionais por mês
          </div>
          {cadastros.length >= 2 ? (
            <SvgLineChart
              data={cadastros.map((c) => c.total)}
              labels={cadastros.map((c) => c.mes.slice(0, 7))}
              color="#26D9A8"
              gradientId="cadastros-chart"
            />
          ) : (
            <p className="text-text-faint text-sm">Dado insuficiente ainda para o gráfico.</p>
          )}
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Faturamento do último ciclo{" "}
            {m.faturamento.ultimo_ciclo.ciclo_referencia && `(${formatarCiclo(m.faturamento.ultimo_ciclo.ciclo_referencia)})`}
          </div>
          {m.faturamento.ultimo_ciclo.ciclo_referencia ? (
            <div className="space-y-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-text-dim">Paga</span>
                <span className="font-mono text-accent">{formatarMoeda(m.faturamento.ultimo_ciclo.paga)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-dim">Pendente</span>
                <span className="font-mono text-amber">{formatarMoeda(m.faturamento.ultimo_ciclo.pendente)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-dim">Atrasada</span>
                <span className="font-mono text-red">{formatarMoeda(m.faturamento.ultimo_ciclo.atrasada)}</span>
              </div>
            </div>
          ) : (
            <p className="text-text-faint text-sm">Nenhuma fatura gerada ainda.</p>
          )}
        </Card>
      </div>

      {receita.length > 0 && (
        <Card className="mt-6">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Receita paga por ciclo
          </div>
          <SvgLineChart
            data={receita.map((r) => r.total)}
            labels={receita.map((r) => formatarCiclo(r.ciclo_referencia))}
            color="#4C8DFF"
            gradientId="receita-chart"
          />
        </Card>
      )}
    </Stage>
  )
}
