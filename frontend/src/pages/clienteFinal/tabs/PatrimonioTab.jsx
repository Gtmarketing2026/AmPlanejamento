import { useQuery } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import { obterMeuPatrimonio } from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

export default function PatrimonioTab({ token }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-patrimonio", token],
    queryFn: () => obterMeuPatrimonio(token),
    enabled: !!token,
  })

  if (isLoading) return <p className="text-text-faint text-sm">Carregando…</p>
  if (!data) return null

  const ativos = data.saldo_contas + data.total_investido

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <KpiStat
          label="Patrimônio líquido"
          value={formatarMoeda(data.patrimonio_liquido)}
          deltaColor={data.patrimonio_liquido >= 0 ? "accent" : "red"}
        />
        <KpiStat label="Total de ativos" value={formatarMoeda(ativos)} />
        <KpiStat label="Total de passivos" value={formatarMoeda(data.total_dividas)} deltaColor="red" />
      </div>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Ativos
          </div>
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-[13px] text-text-dim">Saldo em conta (entradas − saídas)</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.saldo_contas)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[13px] text-text-dim">Investimentos</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.total_investido)}</span>
          </div>
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Passivos
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[13px] text-text-dim">Dívidas em aberto</span>
            <span className="font-mono text-[13.5px] text-red">{formatarMoeda(data.total_dividas)}</span>
          </div>
        </Card>
      </div>

      <p className="text-text-faint text-[11.5px]">
        Bens móveis e imóveis (carro, casa) entram numa próxima atualização — hoje o cálculo considera
        saldo de conta, investimentos e dívidas.
      </p>
    </div>
  )
}
