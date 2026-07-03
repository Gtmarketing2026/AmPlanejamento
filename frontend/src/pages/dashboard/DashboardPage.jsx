import { useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import DonutChart from "../../components/ui/DonutChart"
import Tabs from "../../components/ui/Tabs"
import { useClientes } from "../../hooks/useClientes"
import { dashboardMock as m } from "../../mocks/dashboard.mock"
import FluxoCaixaTab from "./FluxoCaixaTab"
import LancamentosTab from "./LancamentosTab"
import PatrimonioMetasTab from "./PatrimonioMetasTab"

export default function DashboardPage() {
  const { data: clientes } = useClientes()
  const [subtab, setSubtab] = useState("fluxo")
  const clienteAtual = clientes?.[0]

  return (
    <Stage eyebrow="Etapa 04" title="Dashboard de conciliação e planejamento" description="Visão do profissional sobre um cliente específico.">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="font-display font-semibold text-lg">
            {clienteAtual ? clienteAtual.nome : "Nenhum cliente cadastrado ainda"}
          </div>
          <div className="text-text-faint text-[12px] font-mono">Julho 2026</div>
        </div>
        <Pill variant="on" pulse>sincronizado há 4 min</Pill>
      </div>

      {!clienteAtual && (
        <Card className="mb-5">
          <p className="text-text-dim text-sm">
            Cadastre um cliente em <strong>Cadastros → Cliente</strong> pra ver o dashboard dele — os
            números abaixo são ilustrativos, ainda sem transações reais (Open Finance/importação não
            implementados).
          </p>
        </Card>
      )}

      <Card accent className="mb-5">
        <div className="flex items-center gap-4">
          <DonutChart pct={m.saudeFinanceira.pct} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold">
                Saúde financeira: {m.saudeFinanceira.status}
              </span>
              <Pill variant="on">reserva OK</Pill>
            </div>
            <p className="text-text-dim text-[12.5px] mt-1">
              Reserva de emergência cobre {m.saudeFinanceira.reservaMeses} meses de gastos · taxa de
              poupança de {m.saudeFinanceira.taxaPoupanca}% no mês
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-5">
        <Tabs
          options={[
            { value: "fluxo", n: "A", label: "Fluxo de caixa" },
            { value: "lancamentos", n: "B", label: "Lançamentos" },
            { value: "patrimonio", n: "C", label: "Patrimônio & Metas" },
          ]}
          active={subtab}
          onChange={setSubtab}
        />
      </div>

      {subtab === "fluxo" && <FluxoCaixaTab />}
      {subtab === "lancamentos" && <LancamentosTab />}
      {subtab === "patrimonio" && <PatrimonioMetasTab />}
    </Stage>
  )
}
