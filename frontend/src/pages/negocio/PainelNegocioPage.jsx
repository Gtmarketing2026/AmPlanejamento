import { useQuery } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import KpiStat from "../../components/ui/KpiStat"
import { buscarMetricasNegocio } from "../../api/negocio"
import { formatarMoeda } from "../../lib/format"

export default function PainelNegocioPage() {
  const { data: m, isLoading, error } = useQuery({
    queryKey: ["negocio-metricas"],
    queryFn: buscarMetricasNegocio,
  })

  if (isLoading)
    return (
      <Stage eyebrow="Nível Negócio · Admin" title="Painel do negócio">
        <p className="text-text-faint text-sm">Carregando…</p>
      </Stage>
    )
  if (error)
    return (
      <Stage eyebrow="Nível Negócio · Admin" title="Painel do negócio">
        <p className="text-red text-sm">Não foi possível carregar as métricas.</p>
      </Stage>
    )

  const lucro = (m.receita_mes_atual || 0) - (m.despesa_mes_atual || 0)

  return (
    <Stage
      eyebrow="Nível Negócio · Admin"
      title="Painel do negócio"
      description="Visão de tudo — todos os planejadores e a carteira de clientes deles combinada. Números vêm de fatura real (view vw_metricas_negocio)."
    >
      <div className="grid grid-cols-4 gap-4 mb-4">
        <KpiStat label="Planejadores ativos" value={m.planejadores_ativos} />
        <KpiStat
          label="Clientes ativos (total)"
          value={m.clientes_ativos_total}
          delta={m.media_clientes_por_planejador != null ? `média ${m.media_clientes_por_planejador} / planejador` : null}
        />
        <KpiStat label="MRR" value={formatarMoeda(m.mrr)} deltaColor="accent" />
        <KpiStat label="Ticket médio" value={formatarMoeda(m.ticket_medio)} delta="MRR / planejadores ativos" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiStat label="Receita — mês atual" value={formatarMoeda(m.receita_mes_atual)} delta="faturas já pagas" deltaColor="accent" />
        <KpiStat label="Despesa operacional" value={formatarMoeda(m.despesa_mes_atual)} delta="custo de operar a plataforma" deltaColor="red" />
        <KpiStat
          label="Lucro — mês atual"
          value={formatarMoeda(lucro)}
          delta="receita − despesa operacional"
          deltaColor={lucro >= 0 ? "accent" : "red"}
        />
      </div>
    </Stage>
  )
}
