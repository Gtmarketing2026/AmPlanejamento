import { useMemo, useState } from "react"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import SvgLineChart from "../../components/ui/SvgLineChart"
import BarRow from "../../components/ui/BarRow"
import Button from "../../components/ui/Button"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { dashboardMock as m } from "../../mocks/dashboard.mock"

// FV = P(1+i)^n + PMT * (((1+i)^n - 1) / i) — i = taxa mensal, n = meses.
// Matemática real sobre base de dado mockado (patrimonioBase/taxaAnual/prazoAnos).
function projetarPatrimonio(patrimonioBase, aporteExtra, taxaAnualPct, prazoAnos) {
  const i = taxaAnualPct / 100 / 12
  const n = prazoAnos * 12
  const fatorJuros = Math.pow(1 + i, n)
  return patrimonioBase * fatorJuros + aporteExtra * ((fatorJuros - 1) / i)
}

export default function PatrimonioMetasTab() {
  const { patrimonio, curvaProjecao, curvaProjecaoLabels, simulador, projetos, dividas } = m
  const [aporteExtra, setAporteExtra] = useState(300)

  const resultado = useMemo(
    () => projetarPatrimonio(simulador.patrimonioBase, aporteExtra, simulador.taxaAnual, simulador.prazoAnos),
    [aporteExtra]
  )
  const resultadoSemAporte = useMemo(
    () => projetarPatrimonio(simulador.patrimonioBase, 0, simulador.taxaAnual, simulador.prazoAnos),
    []
  )
  const ganho = resultado - resultadoSemAporte

  const fmt = (v) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <KpiStat label="Patrimônio atual" value={patrimonio.atual} delta={patrimonio.delta} deltaColor="accent" />
        <KpiStat label="Meta aposentadoria" value={patrimonio.metaAposentadoriaPct} delta={patrimonio.anoProjecao} />
        <KpiStat label="Reserva de emergência" value={patrimonio.reservaMeses} delta="meta atingida" deltaColor="accent" />
      </div>

      <Card className="mb-5">
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Curva de patrimônio projetado
        </div>
        <SvgLineChart data={curvaProjecao} labels={curvaProjecaoLabels} color="#26D9A8" gradientId="patrimonio-curva" />
      </Card>

      <Card accent className="mb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] font-mono text-blue bg-blue/10 px-2 py-0.5 rounded-full">interativo</span>
          <span className="font-display font-semibold text-[15px]">Simulador — "e se eu aportar mais?"</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1.5">
              Aporte mensal extra
            </div>
            <input
              type="range"
              min={0}
              max={2000}
              step={50}
              value={aporteExtra}
              onChange={(e) => setAporteExtra(Number(e.target.value))}
              className="w-full accent-blue"
            />
            <div className="text-blue font-mono text-[13px] mt-1">+ R$ {aporteExtra}/mês</div>
          </div>
          <div>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1.5">
              Taxa de retorno anual
            </div>
            <div className="text-[13.5px]">{simulador.taxaAnual}% a.a.</div>
          </div>
          <div>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1.5">Prazo</div>
            <div className="text-[13.5px]">{simulador.prazoAnos} anos</div>
          </div>
        </div>
        <div className="flex justify-between items-end pt-3 border-t border-line/60">
          <div>
            <div className="text-[11.5px] text-text-dim mb-1">Patrimônio projetado com esse aporte extra</div>
            <div className="text-blue font-display text-xl font-semibold">{fmt(resultado)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11.5px] text-text-dim mb-1">Ganho vs. cenário sem aporte extra</div>
            <div className="text-accent font-mono">+ {fmt(ganho)}</div>
          </div>
        </div>
      </Card>

      <Card className="mb-5">
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Projetos de vida</div>
        {projetos.map((p) => (
          <BarRow key={p.nome} label={p.nome} pct={p.pct} value={`${p.pct}%`} />
        ))}
        <Button variant="ghost" className="mt-3">+ Adicionar projeto de vida</Button>
      </Card>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Dívidas em aberto</div>
        <Table>
          <Thead>
            <Th>Credor</Th>
            <Th>Tipo</Th>
            <Th>Restante</Th>
            <Th>Parcelas</Th>
            <Th>Previsão quitação</Th>
          </Thead>
          <tbody>
            {dividas.map((d) => (
              <Tr key={d.credor}>
                <Td>{d.credor}</Td>
                <Td className="text-text-dim">{d.tipo}</Td>
                <Td className="font-mono text-red">{d.restante}</Td>
                <Td className="font-mono text-text-dim">{d.parcelas}</Td>
                <Td className="text-text-dim">{d.previsao}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
