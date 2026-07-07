import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import DonutMultiChart from "../../../components/ui/DonutMultiChart"
import { minhasCategorias, minhasTransacoes } from "../../../api/clientes"
import { formatarMoeda } from "../../../lib/format"
import { exportarCsv, exportarPdfViaImpressao } from "../../../lib/exportar"

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const CORES_CATEGORIA = [
  "#26D9A8", "#4C8DFF", "#F0A63C", "#E5645A", "#A78BFA", "#F472B6", "#38BDF8", "#94A3B8",
]

// Mês de referência de um lançamento (1º dia do mês): usa mes_referencia quando
// existe (respeita a virada do cartão), senão cai pra data da transação.
function mesRefDe(t) {
  const base = t.mes_referencia || t.data
  return base.slice(0, 7) // YYYY-MM
}

export default function FluxoTab({ token, contexto = "PF" }) {
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)
  const [mesSelecionado, setMesSelecionado] = useState(null) // null = ano todo, ou 0-11
  const [verPrevistos, setVerPrevistos] = useState(false)

  const filtros = { contexto, incluir_previstos: verPrevistos ? "true" : undefined }
  const { data: transacoes = [] } = useQuery({
    queryKey: ["cliente-eu-transacoes", token, filtros],
    queryFn: () => minhasTransacoes(token, filtros),
    enabled: !!token,
  })
  const { data: categorias = [] } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  const nomePorCategoria = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nome])),
    [categorias]
  )
  // Categorias neutras = movimentação interna (transferências etc.): não somam
  // no fluxo de caixa.
  const neutras = useMemo(
    () => new Set(categorias.filter((c) => c.tipo === "neutra").map((c) => c.id)),
    [categorias]
  )
  const transacoesFluxo = useMemo(
    () => transacoes.filter((t) => !neutras.has(t.categoria_id)),
    [transacoes, neutras]
  )

  // Série mensal (12 meses do ano selecionado): receitas e despesas.
  const serieMensal = useMemo(() => {
    const linha = MESES.map(() => ({ receitas: 0, despesas: 0 }))
    for (const t of transacoesFluxo) {
      const ref = mesRefDe(t)
      const [y, m] = ref.split("-").map(Number)
      if (y !== ano) continue
      const idx = m - 1
      const v = Math.abs(Number(t.valor))
      if (t.tipo === "entrada") linha[idx].receitas += v
      else linha[idx].despesas += v
    }
    return linha
  }, [transacoesFluxo, ano])

  const maxBarra = Math.max(1, ...serieMensal.flatMap((m) => [m.receitas, m.despesas]))

  // Transações do período selecionado (mês específico ou ano todo) -- já sem
  // as neutras (movimentação interna não conta no fluxo).
  const doPeriodo = useMemo(
    () =>
      transacoesFluxo.filter((t) => {
        const [y, m] = mesRefDe(t).split("-").map(Number)
        if (y !== ano) return false
        return mesSelecionado === null || m - 1 === mesSelecionado
      }),
    [transacoesFluxo, ano, mesSelecionado]
  )

  const receitas = doPeriodo.filter((t) => t.tipo === "entrada").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
  const despesas = doPeriodo.filter((t) => t.tipo === "saida").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
  const resultado = receitas - despesas

  // Gasto por categoria no período -> fatias do donut (top 7 + Outros).
  const fatias = useMemo(() => {
    const porCat = {}
    for (const t of doPeriodo) {
      if (t.tipo !== "saida") continue
      const nome = nomePorCategoria[t.categoria_id] || "Sem categoria"
      porCat[nome] = (porCat[nome] || 0) + Math.abs(Number(t.valor))
    }
    const ordenado = Object.entries(porCat)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
    const top = ordenado.slice(0, 7)
    const resto = ordenado.slice(7)
    if (resto.length) top.push({ label: "Outros", valor: resto.reduce((s, x) => s + x.valor, 0) })
    return top.map((f, i) => ({ ...f, cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length] }))
  }, [doPeriodo, nomePorCategoria])

  const rotuloPeriodo = mesSelecionado === null ? `${ano}` : `${MESES[mesSelecionado]}/${ano}`

  function exportarCsvPeriodo() {
    exportarCsv(
      `fluxo-${rotuloPeriodo}.csv`,
      doPeriodo.map((t) => ({
        data: t.data,
        descricao: t.descricao,
        categoria: nomePorCategoria[t.categoria_id] || "Sem categoria",
        tipo: t.tipo,
        valor: t.valor,
        previsto: t.previsto ? "sim" : "não",
      }))
    )
  }
  function exportarPdfPeriodo() {
    const linhas = fatias
      .map((c) => `<tr><td>${c.label}</td><td class="right">${formatarMoeda(c.valor)}</td></tr>`)
      .join("")
    exportarPdfViaImpressao(
      `Fluxo de caixa · ${rotuloPeriodo}`,
      `<p>Receitas: <strong>${formatarMoeda(receitas)}</strong> · Despesas: <strong>${formatarMoeda(
        despesas
      )}</strong> · Resultado: <strong>${formatarMoeda(resultado)}</strong></p>
       <table><thead><tr><th>Categoria</th><th class="right">Gasto</th></tr></thead><tbody>${linhas}</tbody></table>`
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-text-dim text-[13px] -mb-1">
        Como você está indo neste mês (ou ano): quanto entrou, quanto saiu e com o quê — clique num mês do gráfico pra
        ver o detalhe dele.
      </p>

      {/* Filtros de período */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setAno((a) => a - 1)}
            className="w-7 h-7 rounded-[7px] border border-line text-text-dim hover:text-text"
          >
            ‹
          </button>
          <span className="font-mono text-[13px] text-text w-12 text-center">{ano}</span>
          <button
            onClick={() => setAno((a) => a + 1)}
            className="w-7 h-7 rounded-[7px] border border-line text-text-dim hover:text-text"
          >
            ›
          </button>
          <button
            onClick={() => setMesSelecionado(null)}
            className={`ml-2 px-3 py-1.5 rounded-[7px] text-[12px] font-medium ${
              mesSelecionado === null ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text border border-line"
            }`}
          >
            Ano todo
          </button>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] text-text-dim cursor-pointer select-none">
            <input type="checkbox" checked={verPrevistos} onChange={(e) => setVerPrevistos(e.target.checked)} className="accent-accent" />
            Incluir parcelas futuras
          </label>
          <Button variant="ghost" onClick={exportarPdfPeriodo} disabled={!doPeriodo.length}>PDF</Button>
          <Button variant="ghost" onClick={exportarCsvPeriodo} disabled={!doPeriodo.length}>Excel/CSV</Button>
        </div>
      </div>

      {/* KPIs do período */}
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <KpiStat label={`Receitas · ${rotuloPeriodo}`} value={formatarMoeda(receitas)} deltaColor="accent" />
        <KpiStat label="Despesas" value={formatarMoeda(despesas)} deltaColor="red" />
        <KpiStat label="Resultado" value={formatarMoeda(resultado)} deltaColor={resultado >= 0 ? "accent" : "red"} />
      </div>

      {/* Gráfico mensal receitas x despesas (clicável pra filtrar o mês) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            Receitas × Despesas por mês · {ano}
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" /> Receitas</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red" /> Despesas</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-[160px]">
          {serieMensal.map((m, i) => {
            const ativo = mesSelecionado === i
            return (
              <button
                key={i}
                onClick={() => setMesSelecionado(ativo ? null : i)}
                className={`flex-1 flex flex-col items-center justify-end gap-1 h-full rounded-[6px] px-0.5 pt-1 transition-colors ${
                  ativo ? "bg-panel-2" : "hover:bg-panel-2/50"
                }`}
                title={`${MESES[i]}: receitas ${formatarMoeda(m.receitas)} · despesas ${formatarMoeda(m.despesas)}`}
              >
                <div className="flex items-end gap-0.5 w-full justify-center h-full">
                  <div
                    className="w-1/2 max-w-[14px] rounded-t-[3px] bg-accent"
                    style={{ height: `${(m.receitas / maxBarra) * 100}%` }}
                  />
                  <div
                    className="w-1/2 max-w-[14px] rounded-t-[3px] bg-red"
                    style={{ height: `${(m.despesas / maxBarra) * 100}%` }}
                  />
                </div>
                <span className={`text-[10px] font-mono ${ativo ? "text-text" : "text-text-faint"}`}>{MESES[i]}</span>
              </button>
            )
          })}
        </div>
        {mesSelecionado !== null && (
          <p className="text-text-faint text-[11.5px] mt-2">
            Mostrando <strong className="text-text-dim">{MESES[mesSelecionado]}/{ano}</strong> — clique de novo no mês pra ver o ano todo.
          </p>
        )}
      </Card>

      {/* Gasto por categoria (donut) */}
      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-4">
          Gasto por categoria · {rotuloPeriodo}
        </div>
        {fatias.length ? (
          <DonutMultiChart
            fatias={fatias}
            centroLabel="Despesas"
            centroValor={formatarMoeda(despesas)}
          />
        ) : (
          <p className="text-text-faint text-sm">
            Sem gastos nesse período — importe um extrato ou adicione lançamentos.
          </p>
        )}
      </Card>
    </div>
  )
}
