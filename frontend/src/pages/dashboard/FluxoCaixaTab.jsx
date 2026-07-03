import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import BarRow from "../../components/ui/BarRow"
import { dashboardMock as m } from "../../mocks/dashboard.mock"

export default function FluxoCaixaTab() {
  const { fluxoCaixa: f, gastoPorCategoria, ultimasConciliacoes } = m

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-5">
        <KpiStat label="Entradas" value={`R$ ${f.entradas.toLocaleString("pt-BR")}`} delta={f.entradasDelta} deltaColor="accent" />
        <KpiStat label="Saídas" value={`R$ ${f.saidas.toLocaleString("pt-BR")}`} delta={f.saidasDelta} deltaColor="red" />
        <KpiStat label="Conciliado" value={`${f.conciliadoPct}%`} delta={f.pendentes} deltaColor="faint" />
      </div>

      <div className="grid grid-cols-[1.2fr_1fr] gap-5">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Gasto por categoria
          </div>
          {gastoPorCategoria.map((c) => (
            <BarRow key={c.label} label={c.label} pct={c.pct} value={c.valor} />
          ))}
        </Card>
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Últimas conciliações
          </div>
          {ultimasConciliacoes.map((t) => (
            <div key={t.label} className="flex items-center justify-between py-2 border-b border-line last:border-0">
              <div className="flex items-center gap-2 text-[12.5px] text-text-dim">
                <span className="w-2 h-2 rounded-sm bg-accent" />
                {t.label}
              </div>
              <span className="font-mono text-[12.5px]">{t.valor}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
