import { useQuery } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import { buscarMetricasNegocio, buscarCapacidade } from "../../api/negocio"
import { formatarMoeda } from "../../lib/format"

const COR_NIVEL = {
  ok: { cor: "#26D9A8", label: "ok" },
  atencao: { cor: "#F0A63C", label: "atenção" },
  critico: { cor: "#E5645A", label: "crítico" },
  info: { cor: "#5A6570", label: "referência" },
}

function BarraUso({ uso, limite, cor }) {
  if (uso == null || !limite) return null
  const pct = Math.min(100, Math.round((uso / limite) * 100))
  return (
    <div className="h-1.5 rounded-full bg-bg overflow-hidden mt-2">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
    </div>
  )
}

function CapacidadeCard({ item }) {
  const n = COR_NIVEL[item.nivel] || COR_NIVEL.info
  const temMedida = item.uso_atual != null && item.limite != null
  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div className="font-semibold text-[13.5px]">{item.servico}</div>
          <div className="text-text-faint text-[11.5px]">{item.recurso}</div>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: `${n.cor}1a`, color: n.cor }}
        >
          {n.label}
        </span>
      </div>
      {temMedida ? (
        <div className="text-[12.5px] mt-1">
          <span className="font-mono" style={{ color: n.cor }}>
            {item.uso_atual}
          </span>
          <span className="text-text-faint font-mono"> / {item.limite} {item.unidade}</span>
        </div>
      ) : item.uso_atual != null ? (
        <div className="text-[12.5px] mt-1 font-mono text-text-dim">
          {item.uso_atual} {item.unidade}
        </div>
      ) : null}
      <BarraUso uso={item.uso_atual} limite={item.limite} cor={n.cor} />
      <p className="text-text-faint text-[11px] leading-relaxed mt-2">{item.observacao}</p>
    </Card>
  )
}

export default function PainelNegocioPage() {
  const { data: m, isLoading, error } = useQuery({
    queryKey: ["negocio-metricas"],
    queryFn: buscarMetricasNegocio,
  })
  const { data: capacidade } = useQuery({
    queryKey: ["negocio-capacidade"],
    queryFn: buscarCapacidade,
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
      description="Visão de tudo — todos os planejadores e a carteira de clientes deles combinada. Números vêm de fatura real."
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

      {/* Retenção e valor do cliente */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <KpiStat
          label="LTV"
          value={formatarMoeda(m.ltv)}
          delta="ticket médio × tempo de assinatura"
          deltaColor="accent"
        />
        <KpiStat
          label="Tempo médio de assinatura"
          value={m.tempo_medio_assinatura_meses != null ? `${m.tempo_medio_assinatura_meses} meses` : "—"}
          delta="vida média do planejador"
        />
        <KpiStat
          label="Planejadores cancelados"
          value={m.planejadores_cancelados}
          delta={m.churn_pct != null ? `churn ${m.churn_pct}%` : null}
          deltaColor="red"
        />
        <KpiStat
          label="Congelados / clientes excluídos"
          value={`${m.planejadores_congelados} / ${m.clientes_excluidos_total}`}
          delta="inadimplentes · churn de clientes finais"
          deltaColor="red"
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <KpiStat label="Receita — mês atual" value={formatarMoeda(m.receita_mes_atual)} delta="faturas já pagas" deltaColor="accent" />
        <KpiStat label="Receita acumulada" value={formatarMoeda(m.receita_acumulada)} delta="todas as faturas pagas" deltaColor="accent" />
        <KpiStat label="Despesa operacional" value={formatarMoeda(m.despesa_mes_atual)} delta="custo de operar a plataforma" deltaColor="red" />
        <KpiStat
          label="Lucro — mês atual"
          value={formatarMoeda(lucro)}
          delta="receita − despesa operacional"
          deltaColor={lucro >= 0 ? "accent" : "red"}
        />
      </div>

      {/* Capacidade & limites dos serviços externos */}
      <div className="mb-3">
        <h3 className="font-display font-semibold text-[15px]">Capacidade &amp; limites</h3>
        <p className="text-text-dim text-[12.5px]">
          Limites dos serviços externos que podem travar o sistema ao crescer. Onde dá, o uso atual é medido; os limites
          são do tier de entrada de cada serviço (sobe no plano pago).
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        {(capacidade || []).map((item, i) => (
          <CapacidadeCard key={i} item={item} />
        ))}
        {!capacidade && <p className="text-text-faint text-sm">Carregando limites…</p>}
      </div>
    </Stage>
  )
}
