import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import SvgLineChart from "../../components/ui/SvgLineChart"
import Pill from "../../components/ui/Pill"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useClientes } from "../../hooks/useClientes"
import { painelAnaliticoMock as m } from "../../mocks/painelAnalitico.mock"

const TEMP_VARIANT = { engajado: "on", "atenção": "warn", risco: "off" }

export default function PainelAnaliticoPage() {
  const { kpis } = m
  const { data: clientes } = useClientes()

  if (!clientes?.length) {
    return (
      <Stage
        eyebrow="Visão agregada"
        title="Painel analítico do profissional"
        description="Visão de carteira — todos os clientes juntos."
      >
        <Card>
          <p className="text-text-dim text-sm">
            Cadastre pelo menos um cliente em <strong>Cadastros → Cliente</strong> pra ver a visão
            agregada da carteira.
          </p>
        </Card>
      </Stage>
    )
  }

  return (
    <Stage
      eyebrow="Visão agregada"
      title="Painel analítico do profissional"
      description="Visão de carteira — todos os clientes juntos. Dado ilustrativo: as views vw_metricas_carteira/vw_retencao_clientes já existem no banco, mas ainda não têm rota de API."
    >
      <div className="grid grid-cols-3 gap-4 mb-6">
        <KpiStat label="Clientes ativos" value={kpis.clientesAtivos.valor} delta={kpis.clientesAtivos.delta} />
        <KpiStat label="Patrimônio total da carteira" value={kpis.patrimonioTotalCarteira.valor} delta={kpis.patrimonioTotalCarteira.delta} deltaColor="accent" />
        <KpiStat label="Crescimento médio / cliente" value={kpis.crescimentoMedio.valor} delta={kpis.crescimentoMedio.delta} />
        <KpiStat label="Ticket médio" value={kpis.ticketMedio.valor} delta={kpis.ticketMedio.delta} />
        <KpiStat label="LTV médio realizado" value={kpis.ltvMedio.valor} delta={kpis.ltvMedio.delta} />
        <KpiStat label="Taxa de poupança média" value={kpis.taxaPoupancaMedia.valor} delta={kpis.taxaPoupancaMedia.delta} deltaColor="accent" />
      </div>

      <div className="grid grid-cols-[1.3fr_1fr] gap-5 mb-6">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Evolução da carteira de clientes
          </div>
          <SvgLineChart data={m.evolucaoCarteira} labels={m.evolucaoCarteiraLabels} color="#4C8DFF" gradientId="carteira-chart" />
        </Card>
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Temperatura da carteira
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between text-[13px]">
              <span>🟢 Engajados</span>
              <span className="font-mono text-text-dim">{m.temperatura.engajados}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span>🟡 Atenção</span>
              <span className="font-mono text-text-dim">{m.temperatura.atencao}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span>🔴 Risco de churn</span>
              <span className="font-mono text-text-dim">{m.temperatura.risco}</span>
            </div>
          </div>
          <p className="text-text-faint text-[11px] mt-4 leading-relaxed">
            Calculado a partir de: conciliação em dia, interação recente no CRM e progresso das metas.
          </p>
        </Card>
      </div>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Top clientes — melhores resultados
        </div>
        <Table>
          <Thead>
            <Th>#</Th>
            <Th>Cliente</Th>
            <Th>Tipo</Th>
            <Th>Evolução patrimônio</Th>
            <Th>Honorário/mês</Th>
            <Th>Temperatura</Th>
          </Thead>
          <tbody>
            {m.topClientes.map((c, i) => (
              <Tr key={c.nome}>
                <Td className="font-mono text-text-faint">{i + 1}</Td>
                <Td>
                  <span className="font-mono text-[11px] text-text-faint mr-1.5">{c.iniciais}</span>
                  {c.nome}
                </Td>
                <Td>{c.tipo}</Td>
                <Td className="font-mono text-accent">{c.evolucao}</Td>
                <Td className="font-mono">{c.honorario}</Td>
                <Td>
                  <Pill variant={TEMP_VARIANT[c.temperatura]}>{c.temperatura}</Pill>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </Stage>
  )
}
