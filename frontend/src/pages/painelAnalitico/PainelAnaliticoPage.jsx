import { useQuery } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { metricasCarteira } from "../../api/analytics"
import { formatarMoeda } from "../../lib/format"

function pct(v) {
  return v == null ? "—" : `${v}%`
}

export default function PainelAnaliticoPage() {
  const { data: m, isLoading, error } = useQuery({ queryKey: ["metricas-carteira"], queryFn: metricasCarteira })

  if (isLoading) {
    return (
      <Stage eyebrow="Visão agregada" title="Painel analítico do profissional">
        <p className="text-text-faint text-sm">Carregando…</p>
      </Stage>
    )
  }
  if (error) {
    return (
      <Stage eyebrow="Visão agregada" title="Painel analítico do profissional">
        <p className="text-red text-sm">Não foi possível carregar as métricas.</p>
      </Stage>
    )
  }

  if (!m.clientes_ativos && !m.clientes_churned) {
    return (
      <Stage
        eyebrow="Visão agregada"
        title="Painel analítico do profissional"
        description="Visão de carteira — todos os seus clientes juntos."
      >
        <Card>
          <p className="text-text-dim text-sm">
            Cadastre clientes e defina o honorário mensal de cada um pra ver as métricas reais da sua carteira
            (ticket médio, LTV, churn).
          </p>
        </Card>
      </Stage>
    )
  }

  return (
    <Stage
      eyebrow="Visão agregada"
      title="Painel analítico do profissional"
      description="Visão de carteira — todos os seus clientes juntos. Dados reais das views vw_metricas_carteira / vw_retencao_clientes."
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiStat label="Clientes ativos" value={m.clientes_ativos} />
        <KpiStat label="Clientes que saíram" value={m.clientes_churned} delta={`churn ${pct(m.taxa_churn_pct)}`} deltaColor="red" />
        <KpiStat label="Ticket médio" value={formatarMoeda(m.ticket_medio)} delta="honorário mensal / cliente ativo" />
        <KpiStat
          label="LTV médio realizado"
          value={formatarMoeda(m.ltv_medio_realizado)}
          deltaColor="accent"
          info="Honorário mensal × meses desde o cadastro de cada cliente (média da carteira). Cresce com o tempo e assume o honorário fixo — só considera o que você cadastra em cada cliente."
        />
        <KpiStat
          label="LTV projetado"
          value={formatarMoeda(m.ltv_projetado)}
          delta="ticket × retenção observada"
          info="Ticket médio × retenção média dos clientes que já saíram. Enquanto não há churn, usa um fallback de 12 meses."
        />
      </div>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Top clientes — maior LTV realizado
        </div>
        <Table>
          <Thead>
            <Th>#</Th>
            <Th>Cliente</Th>
            <Th>Tipo</Th>
            <Th>Meses de relação</Th>
            <Th>Honorário/mês</Th>
            <Th className="text-right">LTV realizado</Th>
          </Thead>
          <tbody>
            {m.top_clientes.map((c, i) => (
              <Tr key={c.cliente_id}>
                <Td className="font-mono text-text-faint">{i + 1}</Td>
                <Td>{c.nome}</Td>
                <Td>{c.tipo}</Td>
                <Td className="font-mono text-text-dim">{c.meses_relacionamento ?? "—"}</Td>
                <Td className="font-mono">{formatarMoeda(c.valor_honorario_mensal)}</Td>
                <Td className="text-right font-mono text-accent">{formatarMoeda(c.ltv_realizado)}</Td>
              </Tr>
            ))}
            {!m.top_clientes.length && (
              <Tr>
                <Td colSpan={6} className="text-text-faint text-center py-6">
                  Defina o honorário mensal dos clientes pra calcular o LTV.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </Card>
    </Stage>
  )
}
