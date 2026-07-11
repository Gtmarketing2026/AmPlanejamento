import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import { minhasCategorias, minhasSubcategorias, minhasTransacoes } from "../../../api/clientes"
import { formatarData, formatarMoeda } from "../../../lib/format"
import { exportarCsv, exportarPdfViaImpressao } from "../../../lib/exportar"

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const CORES_CATEGORIA = [
  "#26D9A8", "#4C8DFF", "#F0A63C", "#E5645A", "#A78BFA", "#F472B6", "#38BDF8", "#94A3B8",
]

// Cor estável por tag (hash do nome) -- mesma tag sempre com a mesma cor, sem
// precisar guardar cor no banco (mesma lógica usada na aba Lançamentos).
function corDaTag(nome = "") {
  let h = 0
  for (const c of String(nome).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 60% 45%)`
}

// Barra horizontal rotulada (label + barra proporcional + valor) -- usada nos
// três "top N" desta tela (categoria, subcategoria, tags) pra não repetir JSX.
function BarraRotulada({ label, valor, cor, maxV, titulo }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-[12px] text-text-dim truncate" title={titulo || label}>
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-bg overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(valor / maxV) * 100}%`, background: cor }} />
      </div>
      <span className="w-20 shrink-0 text-right text-[12px] font-mono text-text">{formatarMoeda(valor)}</span>
    </div>
  )
}

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
  const { data: subcategorias = [] } = useQuery({
    queryKey: ["cliente-eu-subcategorias", token],
    queryFn: () => minhasSubcategorias(token),
    enabled: !!token,
  })
  const nomePorCategoria = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nome])),
    [categorias]
  )
  const nomePorSubcategoria = useMemo(
    () => Object.fromEntries(subcategorias.map((s) => [s.id, s.nome])),
    [subcategorias]
  )
  // Fora do fluxo de caixa: categorias neutras (movimentação interna, ex:
  // transferências) e de investimento (aplicar dinheiro é patrimônio, não
  // despesa de consumo -- aparece na aba Investimentos).
  const neutras = useMemo(
    () =>
      new Set(
        categorias
          .filter((c) => c.tipo === "neutra" || c.tipo === "investimento")
          .map((c) => c.id)
      ),
    [categorias]
  )
  const transacoesFluxo = useMemo(
    () => transacoes.filter((t) => !neutras.has(t.categoria_id)),
    [transacoes, neutras]
  )
  // Categorias de investimento: aplicar dinheiro é alocação de patrimônio, não
  // despesa de consumo. Entra como série/KPI próprios (não soma nas Despesas).
  const catsInvestimento = useMemo(
    () => new Set(categorias.filter((c) => c.tipo === "investimento").map((c) => c.id)),
    [categorias]
  )

  // Série mensal (12 meses do ano selecionado): receitas, despesas e investimentos.
  const serieMensal = useMemo(() => {
    const linha = MESES.map(() => ({ receitas: 0, despesas: 0, investimentos: 0 }))
    for (const t of transacoes) {
      const ref = mesRefDe(t)
      const [y, m] = ref.split("-").map(Number)
      if (y !== ano) continue
      const idx = m - 1
      const v = Math.abs(Number(t.valor))
      if (catsInvestimento.has(t.categoria_id)) linha[idx].investimentos += v
      else if (neutras.has(t.categoria_id)) continue // movimentação interna: fora do fluxo
      else if (t.tipo === "entrada") linha[idx].receitas += v
      else linha[idx].despesas += v
    }
    return linha
  }, [transacoes, catsInvestimento, neutras, ano])

  const maxBarra = Math.max(1, ...serieMensal.flatMap((m) => [m.receitas, m.despesas, m.investimentos]))

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
  // Investido no período (categorias de investimento) -- fora das despesas.
  const investido = useMemo(() => {
    let s = 0
    for (const t of transacoes) {
      if (!catsInvestimento.has(t.categoria_id)) continue
      const [y, m] = mesRefDe(t).split("-").map(Number)
      if (y !== ano) continue
      if (mesSelecionado !== null && m - 1 !== mesSelecionado) continue
      s += Math.abs(Number(t.valor))
    }
    return s
  }, [transacoes, catsInvestimento, ano, mesSelecionado])

  // Gasto por categoria no período (top 7 + Outros) -- barra da esquerda.
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

  // Gasto por SUBcategoria no período (top 7 + Outros) -- barra da direita,
  // lado a lado com "por categoria" (mesma fonte de dados, quebra diferente).
  const fatiasSub = useMemo(() => {
    const porSub = {}
    for (const t of doPeriodo) {
      if (t.tipo !== "saida") continue
      const nome = t.subcategoria_id ? nomePorSubcategoria[t.subcategoria_id] || "Outros" : "Sem subcategoria"
      porSub[nome] = (porSub[nome] || 0) + Math.abs(Number(t.valor))
    }
    const ordenado = Object.entries(porSub)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
    const top = ordenado.slice(0, 7)
    const resto = ordenado.slice(7)
    if (resto.length) top.push({ label: "Outros", valor: resto.reduce((s, x) => s + x.valor, 0) })
    return top.map((f, i) => ({ ...f, cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length] }))
  }, [doPeriodo, nomePorSubcategoria])

  // Top 3 tags mais usadas no período (por valor gasto) -- as tags já vêm
  // embutidas em cada lançamento (ver TransacaoResposta.tags no backend).
  const fatiasTags = useMemo(() => {
    const porTag = {}
    for (const t of doPeriodo) {
      if (t.tipo !== "saida") continue
      for (const tag of t.tags || []) {
        porTag[tag.nome] = porTag[tag.nome] || { label: tag.nome, valor: 0, n: 0 }
        porTag[tag.nome].valor += Math.abs(Number(t.valor))
        porTag[tag.nome].n += 1
      }
    }
    return Object.values(porTag)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3)
      .map((f) => ({ ...f, cor: corDaTag(f.label) }))
  }, [doPeriodo])

  // Lançamentos mais recentes do período (últimas conciliações).
  const ultimasConciliacoes = useMemo(
    () => [...doPeriodo].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 6),
    [doPeriodo]
  )

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
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        <KpiStat label={`Receitas · ${rotuloPeriodo}`} value={formatarMoeda(receitas)} deltaColor="accent" />
        <KpiStat label="Despesas" value={formatarMoeda(despesas)} deltaColor="red" />
        <KpiStat
          label="Investido"
          value={formatarMoeda(investido)}
          info="Lançamentos classificados como investimento. Não entram nas despesas."
        />
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
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue" /> Investido</span>
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
                title={`${MESES[i]}: receitas ${formatarMoeda(m.receitas)} · despesas ${formatarMoeda(
                  m.despesas
                )} · investido ${formatarMoeda(m.investimentos)}`}
              >
                <div className="flex items-end gap-0.5 w-full justify-center h-full">
                  <div
                    className="w-1/3 max-w-[11px] rounded-t-[3px] bg-accent"
                    style={{ height: `${(m.receitas / maxBarra) * 100}%` }}
                  />
                  <div
                    className="w-1/3 max-w-[11px] rounded-t-[3px] bg-red"
                    style={{ height: `${(m.despesas / maxBarra) * 100}%` }}
                  />
                  <div
                    className="w-1/3 max-w-[11px] rounded-t-[3px] bg-blue"
                    style={{ height: `${(m.investimentos / maxBarra) * 100}%` }}
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

      {/* Gasto por categoria e por subcategoria, lado a lado (só barras -- sem
          donut, que duplicava a mesma legenda em outro formato). */}
      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-4">
          Gasto por categoria e subcategoria · {rotuloPeriodo}
        </div>
        {fatias.length ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 max-md:grid-cols-1">
            <div>
              <div className="text-[10.5px] text-text-faint uppercase tracking-wide font-mono mb-2.5">
                Por categoria
              </div>
              <div className="flex flex-col gap-2.5">
                {fatias.map((c) => (
                  <BarraRotulada key={c.label} {...c} maxV={Math.max(...fatias.map((f) => f.valor), 1)} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10.5px] text-text-faint uppercase tracking-wide font-mono mb-2.5">
                Por subcategoria
              </div>
              <div className="flex flex-col gap-2.5">
                {fatiasSub.map((c) => (
                  <BarraRotulada key={c.label} {...c} maxV={Math.max(...fatiasSub.map((f) => f.valor), 1)} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-text-faint text-sm">
            Sem gastos nesse período — importe um extrato ou adicione lançamentos.
          </p>
        )}
      </Card>

      {/* Tags mais usadas no período (top 3 por valor gasto). */}
      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-4">
          Tags mais usadas · {rotuloPeriodo}
        </div>
        {fatiasTags.length ? (
          <div className="flex flex-col gap-2.5">
            {fatiasTags.map((t) => (
              <BarraRotulada
                key={t.label}
                label={`${t.label} (${t.n}×)`}
                titulo={`${t.label} — ${t.n} lançamento${t.n === 1 ? "" : "s"}`}
                valor={t.valor}
                cor={t.cor}
                maxV={Math.max(...fatiasTags.map((f) => f.valor), 1)}
              />
            ))}
          </div>
        ) : (
          <p className="text-text-faint text-sm">
            Nenhuma tag usada nesse período — marque lançamentos com tags na aba Lançamentos.
          </p>
        )}
      </Card>

      {/* Últimas conciliações (lançamentos mais recentes do período) */}
      {ultimasConciliacoes.length > 0 && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Últimas conciliações
          </div>
          {ultimasConciliacoes.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between py-2 border-b border-line last:border-0"
            >
              <div className="flex items-center gap-2.5 text-[12.5px] text-text-dim min-w-0">
                <span
                  className={`w-2 h-2 rounded-sm shrink-0 ${t.tipo === "entrada" ? "bg-accent" : "bg-red"}`}
                />
                <span className="truncate">{t.descricao}</span>
                <span className="text-text-faint text-[11px] font-mono shrink-0">{formatarData(t.data)}</span>
              </div>
              <span className={`font-mono text-[12.5px] shrink-0 ${t.tipo === "entrada" ? "text-accent" : "text-text"}`}>
                {t.tipo === "entrada" ? "+ " : "- "}
                {formatarMoeda(Math.abs(Number(t.valor)))}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
