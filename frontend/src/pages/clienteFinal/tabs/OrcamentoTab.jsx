import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import { Select } from "../../../components/ui/Field"
import { minhasCategorias, minhasSubcategorias, minhasTransacoes } from "../../../api/clientes"
import {
  atualizarMeuOrcamento,
  criarMeuOrcamento,
  excluirMeuOrcamento,
  listarMeusOrcamentos,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const CORES = ["#26D9A8", "#4C8DFF", "#F0A63C", "#E5645A", "#A78BFA", "#F472B6", "#38BDF8", "#FBBF24", "#34D399", "#94A3B8"]

// Faixas de uso da meta (fonte única: cor da barra + rótulo + filtro).
// 0 = cinza (nada gasto), até 30% azul, até 50% verde, até 100% amarelo
// (chegando no limite), acima da meta vermelho.
const FAIXAS_META = [
  { key: "cinza", label: "Sem uso", cor: "var(--color-text-faint)", teste: (p) => p <= 0 },
  { key: "azul", label: "Até 30%", cor: "var(--color-blue)", teste: (p) => p > 0 && p <= 30 },
  { key: "verde", label: "31 a 50%", cor: "var(--color-accent)", teste: (p) => p > 30 && p <= 50 },
  { key: "amarelo", label: "51 a 100%", cor: "var(--color-amber)", teste: (p) => p > 50 && p <= 100 },
  { key: "vermelho", label: "Acima da meta", cor: "var(--color-red)", teste: (p) => p > 100 },
]
const faixaDaPct = (pct) => FAIXAS_META.find((f) => f.teste(pct)) || FAIXAS_META[0]
const corPorPctMeta = (pct) => faixaDaPct(pct).cor
const bandaDaPct = (pct) => faixaDaPct(pct).key

function mesRefDe(t) {
  return (t.mes_referencia || t.data).slice(0, 7)
}

export default function OrcamentoTab({ token, contexto = "PF", onVerLancamentos }) {
  const qc = useQueryClient()
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [cenario, setCenario] = useState("com_metas") // atual | com_metas (destaque do resumo)
  const [categoriaId, setCategoriaId] = useState("")
  const [subcategoriaId, setSubcategoriaId] = useState("")
  const [valorOrcado, setValorOrcado] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [valorEdicao, setValorEdicao] = useState("")
  const [erro, setErro] = useState(null)

  const { data: categorias } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  const { data: subcategorias } = useQuery({
    queryKey: ["cliente-eu-subcategorias", token],
    queryFn: () => minhasSubcategorias(token),
    enabled: !!token,
  })
  const subcategoriasDaCategoria = (subcategorias || []).filter((s) => s.categoria_id === categoriaId)
  const { data: transacoes = [] } = useQuery({
    queryKey: ["cliente-eu-transacoes", token, { contexto }],
    queryFn: () => minhasTransacoes(token, { contexto }),
    enabled: !!token,
  })
  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-orcamentos", token, ano, mes],
    queryFn: () => listarMeusOrcamentos(token, ano, mes),
    enabled: !!token,
  })

  // Fora do fluxo: neutras (movimentação interna) e investimento (patrimônio).
  const neutras = useMemo(
    () =>
      new Set(
        (categorias || [])
          .filter((c) => c.tipo === "neutra" || c.tipo === "investimento")
          .map((c) => c.id)
      ),
    [categorias]
  )
  const mesRef = `${ano}-${String(mes).padStart(2, "0")}`
  const doMes = useMemo(
    () => transacoes.filter((t) => mesRefDe(t) === mesRef && !t.previsto && !neutras.has(t.categoria_id)),
    [transacoes, mesRef, neutras]
  )
  const renda = doMes.filter((t) => t.tipo === "entrada").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
  const gastosReais = doMes.filter((t) => t.tipo === "saida").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)

  // Metas de RENDA (categorias de entrada) x metas de DESPESA são coisas
  // diferentes: a meta de renda é a renda ESPERADA (aparece como linha de
  // referência na barra verde e alimenta as mensagens do "Com metas"); as de
  // despesa alimentam a lista/gráfico de gastos. Por isso separamos as duas.
  const idsEntrada = useMemo(
    () => new Set((categorias || []).filter((c) => c.tipo === "entrada").map((c) => c.id)),
    [categorias]
  )
  const orcamentosRenda = orcamentos.filter((o) => idsEntrada.has(o.categoria_id))
  const orcamentosDespesa = orcamentos.filter((o) => !idsEntrada.has(o.categoria_id))
  // Renda esperada = soma das metas de renda. rendaPlano = base usada no plano
  // (renda esperada quando definida; senão cai na renda real do mês).
  const rendaMeta = orcamentosRenda.reduce((s, o) => s + Number(o.valor_orcado), 0)
  const rendaPlano = rendaMeta > 0 ? rendaMeta : renda
  const orcamentoRendaExistente = orcamentosRenda[0] || null
  const catRenda = (categorias || []).find((c) => c.tipo === "entrada") || null

  const totalOrcado = orcamentosDespesa.reduce((s, o) => s + Number(o.valor_orcado), 0)

  // Segmentos coloridos por categoria orçada (pra barra empilhada e a lista de metas).
  const segmentos = orcamentosDespesa.map((o, i) => ({ ...o, cor: CORES[i % CORES.length] }))

  // Filtro por faixa de uso (cor) da lista de metas. Cada meta ganha _pct e a
  // banda correspondente; o filtro mostra só as de uma faixa.
  const [filtroBanda, setFiltroBanda] = useState(null)
  const segmentosComBanda = segmentos.map((o) => ({
    ...o,
    _pct: o.valor_orcado ? Math.round((o.valor_realizado / o.valor_orcado) * 100) : 0,
  }))
  const contagemPorBanda = segmentosComBanda.reduce((acc, o) => {
    const b = bandaDaPct(o._pct)
    acc[b] = (acc[b] || 0) + 1
    return acc
  }, {})
  const segmentosFiltrados = filtroBanda
    ? segmentosComBanda.filter((o) => bandaDaPct(o._pct) === filtroBanda)
    : segmentosComBanda

  // Versão do "Com metas" agrupada só por CATEGORIA (soma as metas de todas as
  // subcategorias dela) -- o gráfico/legenda mostram só a categoria; a quebra
  // por subcategoria fica exclusiva do popup ao clicar no segmento.
  const segmentosPorCategoria = useMemo(() => {
    const map = {}
    for (const o of orcamentos) {
      if (idsEntrada.has(o.categoria_id)) continue // metas de renda não entram no gráfico de despesas
      const key = o.categoria_id || "sem"
      if (!map[key]) {
        map[key] = {
          id: `cat-${key}`,
          categoria_id: o.categoria_id,
          categoria_nome: o.categoria_nome,
          valor_orcado: 0,
          valor_realizado: 0,
        }
      }
      map[key].valor_orcado += Number(o.valor_orcado)
      map[key].valor_realizado += Number(o.valor_realizado || 0)
    }
    // Ordena pelo REALIZADO (como o "Atual") -- o gráfico mostra o gasto real
    // por categoria; a meta entra só como linha de referência.
    return Object.values(map)
      .sort((a, b) => b.valor_realizado - a.valor_realizado)
      .map((s, i) => ({ ...s, cor: CORES[i % CORES.length] }))
  }, [orcamentos, idsEntrada])

  // Composição REAL do mês por categoria (independe de ter meta): usada na
  // visão "Atual" pra mostrar o uso por categoria mesmo sem nenhuma meta setada.
  const nomePorCategoria = useMemo(
    () => Object.fromEntries((categorias || []).map((c) => [c.id, c.nome])),
    [categorias]
  )
  const nomePorSubcategoria = useMemo(
    () => Object.fromEntries((subcategorias || []).map((s) => [s.id, s.nome])),
    [subcategorias]
  )
  const segmentosReais = useMemo(() => {
    const map = {}
    for (const t of doMes) {
      if (t.tipo !== "saida") continue
      const cid = t.categoria_id || "sem"
      if (!map[cid]) {
        map[cid] = {
          id: `real-${cid}`,
          categoria_id: t.categoria_id || null,
          categoria_nome: nomePorCategoria[t.categoria_id] || "Sem categoria",
          subcategoria_nome: null,
          valor: 0,
        }
      }
      map[cid].valor += Math.abs(Number(t.valor))
    }
    return Object.values(map)
      .sort((a, b) => b.valor - a.valor)
      .map((s, i) => ({ ...s, cor: CORES[i % CORES.length] }))
  }, [doMes, nomePorCategoria])

  // Quebra de uma categoria em subcategorias (valores reais do mês) -- pro
  // popup ao clicar num segmento do gráfico (funciona nas duas visões).
  // segAberto = { id: id do segmento clicado, cat: categoria_id ("sem"), nome }.
  const [segAberto, setSegAberto] = useState(null)
  const subcategoriasDoSegmento = useMemo(() => {
    if (!segAberto) return []
    const map = {}
    let total = 0
    for (const t of doMes) {
      if (t.tipo !== "saida") continue
      const cid = t.categoria_id || "sem"
      if (cid !== segAberto.cat) continue
      const sid = t.subcategoria_id || "sem-sub"
      const nome = t.subcategoria_id ? nomePorSubcategoria[t.subcategoria_id] || "Outros" : "Sem subcategoria"
      map[sid] = map[sid] || { nome, valor: 0 }
      map[sid].valor += Math.abs(Number(t.valor))
      total += Math.abs(Number(t.valor))
    }
    return Object.values(map)
      .sort((a, b) => b.valor - a.valor)
      .map((s) => ({ ...s, pct: total ? Math.round((s.valor / total) * 100) : 0 }))
  }, [segAberto, doMes, nomePorSubcategoria])

  // Segmentos e valores usados pelo gráfico conforme o cenário. Nos DOIS casos
  // o tamanho do segmento é o gasto REAL da categoria -- no "Com metas" a meta
  // vira só uma linha de referência (marcador) sobre a barra.
  const realizadoDeMetas = orcamentosDespesa.reduce((s, o) => s + Number(o.valor_realizado || 0), 0)
  const segmentosGrafico = cenario === "atual" ? segmentosReais : segmentosPorCategoria
  const valorDoSegmento = (s) => (cenario === "atual" ? Number(s.valor) : Number(s.valor_realizado))
  const graficoTemDados = cenario === "atual" ? gastosReais > 0 : orcamentos.length > 0

  const sobraAtual = renda - gastosReais
  // Plano usa a renda ESPERADA (meta de renda) como base -- não a real.
  const sobraPlano = rendaPlano - totalOrcado
  const economia = gastosReais - totalOrcado // >0 = plano gasta menos que hoje

  // Regra de bolso (estimativa, igual à cobertura de vida na Proteção):
  // reserva de emergência = 6x os gastos médios do mês.
  const reservaIdeal = gastosReais * 6

  // % dos gastos reais em relação à renda -- excesso (ou economia) do mês.
  const pctGastoVsRenda = renda > 0 ? Math.round((gastosReais / renda) * 100) : 0
  const pctExcesso = renda > 0 ? Math.round(((gastosReais - renda) / renda) * 100) : 0
  // % do plano (metas) sobre a renda esperada -- usado nas mensagens do Com metas.
  const pctPlanoVsRenda = rendaPlano > 0 ? Math.round((totalOrcado / rendaPlano) * 100) : 0

  // Se cumprir as metas (gastar só o orçado), sobra mensal e total no ano.
  const economiaMensalComMetas = sobraPlano
  const economiaAnualComMetas = sobraPlano * 12

  // Categoria continua disponível mesmo com uma meta já criada -- só não
  // deixa repetir exatamente o mesmo par categoria+subcategoria (o backend
  // também garante isso, aqui é só pra já vir com a subcategoria zerada).
  const categoriasDisponiveis = (categorias || []).filter((c) => c.tipo === "saida")

  const criar = useMutation({
    mutationFn: () =>
      criarMeuOrcamento(token, {
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId || null,
        ano,
        mes,
        valor_orcado: Number(valorOrcado),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-orcamentos", token] })
      setCategoriaId("")
      setSubcategoriaId("")
      setValorOrcado("")
      setErro(null)
    },
    onError: (e) => setErro(e.message || "Não foi possível criar essa meta."),
  })
  const editar = useMutation({
    mutationFn: (id) => atualizarMeuOrcamento(token, id, { valor_orcado: Number(valorEdicao) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-orcamentos", token] })
      setEditandoId(null)
    },
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirMeuOrcamento(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-orcamentos", token, ano, mes] }),
  })

  // Renda esperada (meta de renda): uma meta na categoria Renda, sem
  // subcategoria. Cria se não existir, atualiza se já existir.
  const [rendaInput, setRendaInput] = useState("")
  const [editandoRenda, setEditandoRenda] = useState(false)
  const salvarRenda = useMutation({
    mutationFn: () =>
      orcamentoRendaExistente
        ? atualizarMeuOrcamento(token, orcamentoRendaExistente.id, { valor_orcado: Number(rendaInput) })
        : criarMeuOrcamento(token, {
            categoria_id: catRenda?.id,
            subcategoria_id: null,
            ano,
            mes,
            valor_orcado: Number(rendaInput),
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-orcamentos", token] })
      setEditandoRenda(false)
    },
  })

  // Coluna Renda (sólida) x coluna Despesas (empilhada por categoria/
  // subcategoria, com % de cada segmento) lado a lado -- mostra visualmente
  // do que o gasto é composto em relação à renda.
  function GraficoComposicao() {
    // Despesas do gráfico = gasto REAL (nas duas visões). No "Com metas" a
    // escala também considera a meta total, pra a linha de referência caber
    // quando você ainda gastou menos que o planejado.
    const totalDespesas = cenario === "atual" ? gastosReais : realizadoDeMetas
    const comMetas = cenario === "com_metas"
    const escalaMax = Math.max(1, renda, totalDespesas, comMetas ? totalOrcado : 0, comMetas ? rendaMeta : 0)
    const alturaMax = 260
    const alturaDespesas = Math.max(4, (totalDespesas / escalaMax) * alturaMax)
    // Eixo de valores (faixa à esquerda) -- dá noção da magnitude (faturamento).
    const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => Math.round(escalaMax * f))

    return (
      <div className="flex items-end gap-6 justify-center py-2">
        {/* Faixa de valores (eixo Y) -- mesma estrutura das colunas (área da
            barra + rótulo) pra alinhar a base com os R$0. */}
        <div className="flex flex-col items-end gap-2">
          <div
            className="flex flex-col justify-between items-end text-[10px] font-mono text-text-faint pr-1"
            style={{ height: `${alturaMax}px` }}
          >
            {ticks.map((v, i) => (
              <span key={i} className="leading-none">{formatarMoeda(v)}</span>
            ))}
          </div>
          <span className="text-[11.5px] invisible" aria-hidden>.</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          {/* Trilho da renda: barra real (verde) + marcador da renda esperada. */}
          <div className="relative w-20" style={{ height: `${alturaMax}px` }}>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-[6px] bg-accent flex items-start justify-center pt-1.5"
              style={{ height: `${Math.max(4, (renda / escalaMax) * alturaMax)}px` }}
            >
              <span className="text-[11px] font-mono text-[#062019] font-semibold">{formatarMoeda(renda)}</span>
            </div>
            {comMetas && rendaMeta > 0 && (
              <div
                className="absolute left-[-4px] right-[-4px] border-t-2 border-dashed border-accent/80 flex justify-end"
                style={{ bottom: `${Math.min(alturaMax, (rendaMeta / escalaMax) * alturaMax)}px` }}
                title={`Renda esperada: ${formatarMoeda(rendaMeta)}`}
              >
                <span className="text-[9.5px] font-mono text-accent -mt-3.5 bg-panel px-1 rounded">
                  meta {formatarMoeda(rendaMeta)}
                </span>
              </div>
            )}
          </div>
          <span className="text-[11.5px] text-text-dim">Renda</span>
        </div>
        <div className="flex flex-col items-center gap-2 relative">
          {/* Trilho de altura fixa: os segmentos (gasto real) preenchem de baixo
              pra cima, e o marcador da meta pode flutuar acima deles. */}
          <div className="relative w-20" style={{ height: `${alturaMax}px` }}>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-[6px] overflow-hidden flex flex-col-reverse"
              style={{ height: `${alturaDespesas}px` }}
            >
              {segmentosGrafico.map((s) => {
                const valor = valorDoSegmento(s)
                if (!valor) return null
                const pct = totalDespesas ? Math.round((valor / totalDespesas) * 100) : 0
                const cat = s.categoria_id || "sem"
                const aberto = segAberto?.id === s.id
                return (
                  <div
                    key={s.id}
                    title={`${s.categoria_nome}${s.subcategoria_nome ? " · " + s.subcategoria_nome : ""}: ${formatarMoeda(valor)} (${pct}%) — clique para ver as subcategorias`}
                    onClick={() =>
                      setSegAberto((a) => (a?.id === s.id ? null : { id: s.id, cat, nome: s.categoria_nome }))
                    }
                    style={{ height: `${(valor / totalDespesas) * 100}%`, background: s.cor }}
                    className={`flex items-center justify-center cursor-pointer ${
                      aberto ? "ring-2 ring-white/70 ring-inset" : ""
                    }`}
                  >
                    {pct >= 8 && <span className="text-[10px] text-white/90 font-mono">{pct}%</span>}
                  </div>
                )
              })}
            </div>
            {/* Marcador da meta total (linha tracejada) -- só no "Com metas". */}
            {comMetas && totalOrcado > 0 && (
              <div
                className="absolute left-[-4px] right-[-4px] border-t-2 border-dashed border-white/70 flex justify-end"
                style={{ bottom: `${Math.min(alturaMax, (totalOrcado / escalaMax) * alturaMax)}px` }}
                title={`Meta total: ${formatarMoeda(totalOrcado)}`}
              >
                <span className="text-[9.5px] font-mono text-text-faint -mt-3.5 bg-panel px-1 rounded">
                  meta {formatarMoeda(totalOrcado)}
                </span>
              </div>
            )}
          </div>
          <span className="text-[11.5px] text-text-dim">{comMetas ? "Gasto real (das metas)" : "Gastos reais"}</span>

          {/* Popup: quebra real por subcategoria da categoria do segmento clicado. */}
          {segAberto && (
            <div className="absolute left-[calc(50%+56px)] top-0 z-20 w-72 max-w-[80vw] bg-panel border border-line rounded-[10px] shadow-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-text">{segAberto.nome}</span>
                <button onClick={() => setSegAberto(null)} className="text-text-faint hover:text-text text-[13px] leading-none">✕</button>
              </div>
              <div className="text-[10.5px] text-text-faint -mt-1 mb-2">Gasto real por subcategoria no mês</div>
              {subcategoriasDoSegmento.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {subcategoriasDoSegmento.map((sub) => (
                    <div key={sub.nome} className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="text-text-dim truncate min-w-0" title={sub.nome}>{sub.nome}</span>
                      <span className="font-mono text-text whitespace-nowrap shrink-0">
                        {formatarMoeda(sub.valor)} <span className="text-text-faint">({sub.pct}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-faint text-[11.5px]">Sem gastos reais nesta categoria em {MESES[mes - 1]}/{ano}.</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Select label="Mês" value={mes} onChange={(e) => setMes(Number(e.target.value))} className="w-36">
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </Select>
          <Select label="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-24">
            {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-1 bg-panel border border-line rounded-[9px] p-1 self-end">
          {[
            { v: "atual", label: "Atual" },
            { v: "com_metas", label: "Com metas" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setCenario(o.v)}
              className={`px-3.5 py-1.5 rounded-[7px] text-[12px] font-semibold ${
                cenario === o.v ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <KpiStat
          label={cenario === "atual" ? "Renda do mês" : "Renda esperada"}
          value={formatarMoeda(cenario === "atual" ? renda : rendaPlano)}
          deltaColor="accent"
          info={cenario === "com_metas" && rendaMeta === 0 ? "Defina a renda esperada nas metas (sem meta, usa a renda real)." : undefined}
        />
        <KpiStat
          label={cenario === "atual" ? "Gastos atuais" : "Gastos planejados"}
          value={formatarMoeda(cenario === "atual" ? gastosReais : totalOrcado)}
          deltaColor="red"
        />
        <KpiStat
          label={cenario === "atual" ? "Sobra atual" : "Sobra no plano"}
          value={formatarMoeda(cenario === "atual" ? sobraAtual : sobraPlano)}
          deltaColor={(cenario === "atual" ? sobraAtual : sobraPlano) >= 0 ? "accent" : "red"}
        />
      </div>

      {/* Composição: Renda x Gastos, mostrando do que o gasto é feito.
          Na visão "Atual" aparece sempre que houver gasto (não depende de meta);
          em "Com metas" depende de ter metas cadastradas. */}
      {graficoTemDados && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">
            Composição do mês · {MESES[mes - 1]}/{ano}
            <span className="text-text-faint">
              {cenario === "atual" ? " · uso real por categoria" : " · gasto real (meta = linha de referência)"}
            </span>
          </div>

          <GraficoComposicao />

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
            {segmentosGrafico.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.cor }} />
                {s.categoria_nome}
                {s.subcategoria_nome && <span className="text-text-faint">· {s.subcategoria_nome}</span>}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {/* Mensagens da visão ATUAL: gasto real x renda real do mês. */}
            {cenario === "atual" && renda > 0 && (
              <div className="bg-panel-2 rounded-[9px] px-4 py-3 text-[12.5px]">
                {gastosReais > renda ? (
                  <>
                    Você gasta <strong className="text-red">{formatarMoeda(gastosReais - renda)}</strong> (
                    <strong className="text-red">{pctExcesso}%</strong>) a mais do que ganha este mês.
                  </>
                ) : (
                  <>
                    Você está gastando <strong className="text-accent">{pctGastoVsRenda}%</strong> da sua renda este mês
                    — economizando {formatarMoeda(sobraAtual)} ({100 - pctGastoVsRenda}%).
                  </>
                )}
              </div>
            )}
            {/* Mensagens da visão COM METAS: plano x renda ESPERADA. */}
            {cenario === "com_metas" && orcamentosDespesa.length > 0 && rendaPlano > 0 && (
              <div className="bg-panel-2 rounded-[9px] px-4 py-3 text-[12.5px]">
                Com as metas, você planeja gastar <strong className={pctPlanoVsRenda > 100 ? "text-red" : "text-accent"}>{pctPlanoVsRenda}%</strong> da renda{" "}
                {rendaMeta > 0 ? "esperada" : "real"} ({formatarMoeda(rendaPlano)})
                {sobraPlano >= 0 ? (
                  <> e sobra <strong className="text-accent">{formatarMoeda(sobraPlano)}</strong> por mês pra investir.</>
                ) : (
                  <> — o plano estoura a renda em <strong className="text-red">{formatarMoeda(-sobraPlano)}</strong>.</>
                )}
              </div>
            )}
            {cenario === "com_metas" && orcamentosDespesa.length > 0 && economiaMensalComMetas > 0 && (
              <div className="bg-panel-2 rounded-[9px] px-4 py-3 text-[12.5px]">
                Ao cumprir suas metas, você economiza{" "}
                <strong className="text-accent">{formatarMoeda(economiaMensalComMetas)}</strong> todos os meses —{" "}
                <strong className="text-accent">{formatarMoeda(economiaAnualComMetas)}</strong> no ano.
              </div>
            )}
            {/* Comparação plano x gasto real (só quando útil, nas duas visões). */}
            {cenario === "com_metas" && orcamentosDespesa.length > 0 && gastosReais > 0 && economia < 0 && (
              <div className="bg-panel-2 rounded-[9px] px-4 py-3 text-[12.5px]">
                Suas metas somam <strong className="text-amber">{formatarMoeda(-economia)}</strong> a mais do que você
                gastou de fato este mês — dá pra apertar os limites.
              </div>
            )}
            {gastosReais > 0 && (
              <div className="bg-panel-2 rounded-[9px] px-4 py-3 text-[12.5px]">
                De acordo com seus gastos médios atuais, a reserva de emergência ideal pra sua segurança é de{" "}
                <strong className="text-accent">{formatarMoeda(reservaIdeal)}</strong>{" "}
                <span className="text-text-faint">(estimativa: 6x os gastos do mês)</span>.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Renda esperada (meta de renda) -- vira a linha de referência na barra
          verde do gráfico e a base das mensagens do "Com metas". */}
      {catRenda && (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">Renda esperada por mês</div>
              <div className="text-text-faint text-[11.5px] mt-0.5">
                Quanto você costuma receber. Vira a linha de referência da renda no gráfico "Com metas".
              </div>
            </div>
            {editandoRenda ? (
              <div className="flex items-end gap-2">
                <div>
                  <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">Valor (R$)</div>
                  <input
                    type="number"
                    autoFocus
                    value={rendaInput}
                    onChange={(e) => setRendaInput(e.target.value)}
                    className="w-32 bg-bg border border-line rounded-[9px] px-3 py-2 text-[13px] text-text outline-none focus:border-accent/60"
                  />
                </div>
                <Button onClick={() => rendaInput && salvarRenda.mutate()} disabled={!rendaInput || salvarRenda.isPending} className="mb-0.5">
                  {salvarRenda.isPending ? "Salvando…" : "Salvar"}
                </Button>
                <Button variant="ghost" onClick={() => setEditandoRenda(false)} className="mb-0.5">Cancelar</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="font-mono text-[15px] text-accent">
                  {rendaMeta > 0 ? formatarMoeda(rendaMeta) : "não definida"}
                </span>
                <button
                  onClick={() => {
                    setRendaInput(rendaMeta > 0 ? String(rendaMeta) : "")
                    setEditandoRenda(true)
                  }}
                  className="text-text-faint hover:text-text text-[12px]"
                >
                  {rendaMeta > 0 ? "Editar" : "Definir"}
                </button>
                {rendaMeta > 0 && orcamentoRendaExistente && (
                  <button
                    onClick={() => excluir.mutate(orcamentoRendaExistente.id)}
                    className="text-text-faint hover:text-red text-[12px]"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Metas por categoria */}
      <Card>
        <div className="mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            Metas de gasto por categoria
          </div>
          <div className="text-text-faint text-[11.5px] mt-0.5">
            As metas valem pra <strong className="text-text-dim">todos os meses</strong> — o que muda por mês é só
            o quanto você já gastou. Vendo o realizado de {MESES[mes - 1]}/{ano}.
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (categoriaId && valorOrcado) criar.mutate()
          }}
          className="flex gap-3 flex-wrap items-end mb-2"
        >
          <div className="w-52">
            <Select
              label="Categoria"
              value={categoriaId}
              onChange={(e) => {
                setCategoriaId(e.target.value)
                setSubcategoriaId("")
              }}
            >
              <option value="">Selecione…</option>
              {categoriasDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </div>
          <div className="w-52">
            <Select
              label="Subcategoria (opcional)"
              value={subcategoriaId}
              onChange={(e) => setSubcategoriaId(e.target.value)}
              disabled={!categoriaId}
            >
              <option value="">Categoria inteira</option>
              {subcategoriasDaCategoria.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </Select>
          </div>
          <div className="w-40 mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">Meta (R$)</div>
            <input
              type="number"
              value={valorOrcado}
              onChange={(e) => setValorOrcado(e.target.value)}
              className="w-full bg-bg border border-line rounded-[9px] px-3.5 py-3 text-[13.5px] text-text outline-none focus:border-accent/60"
            />
          </div>
          <Button type="submit" className="mb-3" disabled={!categoriaId || !valorOrcado || criar.isPending}>
            Adicionar
          </Button>
        </form>
        {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}

        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && !orcamentosDespesa.length && (
          <p className="text-text-faint text-[12.5px]">
            Nenhuma meta ainda — adicione a primeira acima. Ela passa a valer em todos os meses.
          </p>
        )}

        {/* Filtro por faixa de uso (cor): mostra só as metas de um status. */}
        {orcamentosDespesa.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <button
              onClick={() => setFiltroBanda(null)}
              className={`px-2.5 py-1 rounded-full text-[11.5px] border transition-colors ${
                filtroBanda === null
                  ? "bg-panel-2 border-text-faint text-text"
                  : "border-line text-text-dim hover:text-text"
              }`}
            >
              Todas ({segmentosComBanda.length})
            </button>
            {FAIXAS_META.filter((f) => contagemPorBanda[f.key]).map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltroBanda(filtroBanda === f.key ? null : f.key)}
                title={f.label}
                className={`px-2.5 py-1 rounded-full text-[11.5px] border flex items-center gap-1.5 transition-colors ${
                  filtroBanda === f.key ? "border-text-faint text-text" : "border-line text-text-dim hover:text-text"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.cor }} />
                {f.label} ({contagemPorBanda[f.key]})
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {segmentosFiltrados.map((o) => {
            const pctReal = o.valor_orcado ? Math.round((o.valor_realizado / o.valor_orcado) * 100) : 0
            const estourou = Number(o.valor_realizado) > Number(o.valor_orcado)
            const restante = Number(o.valor_orcado) - Number(o.valor_realizado)
            // Escala da barra: quando estoura, o realizado vira a régua (a barra
            // preenche 100% e o marcador da meta "recua" pra mostrar o quanto
            // passou); sem estouro, a régua é a própria meta (marcador na ponta).
            const escala = Math.max(Number(o.valor_orcado), Number(o.valor_realizado), 1)
            const pctFill = Math.min(100, (Number(o.valor_realizado) / escala) * 100)
            const pctMarcador = Math.min(100, (Number(o.valor_orcado) / escala) * 100)
            return (
              <div
                key={o.id}
                onClick={() =>
                  onVerLancamentos?.({
                    categoria_id: o.categoria_id,
                    subcategoria_id: o.subcategoria_id || "",
                    mes_referencia: `${ano}-${String(mes).padStart(2, "0")}-01`,
                  })
                }
                title={onVerLancamentos ? "Ver os lançamentos desta meta" : undefined}
                className={`border border-line rounded-[9px] px-3.5 py-3 ${
                  onVerLancamentos ? "cursor-pointer hover:border-text-faint transition-colors" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 font-medium text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.cor }} />
                    {o.categoria_nome}
                    {o.subcategoria_nome && (
                      <span className="text-text-faint font-normal text-[12px]">› {o.subcategoria_nome}</span>
                    )}
                  </span>
                  {/* stopPropagation: editar/excluir não devem navegar. */}
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {editandoId === o.id ? (
                      <>
                        <input
                          type="number"
                          autoFocus
                          value={valorEdicao}
                          onChange={(e) => setValorEdicao(e.target.value)}
                          className="w-24 bg-bg border border-line rounded-[8px] px-2.5 py-1 text-[12px] text-text outline-none focus:border-accent/60"
                        />
                        <button onClick={() => editar.mutate(o.id)} className="text-accent text-[12px] hover:underline">Salvar</button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setEditandoId(o.id); setValorEdicao(String(o.valor_orcado)) }}
                        className="text-text-faint hover:text-text text-[11.5px]"
                      >
                        Editar meta
                      </button>
                    )}
                    <button onClick={() => excluir.mutate(o.id)} className="text-text-faint hover:text-red text-[11.5px]">✕</button>
                  </div>
                </div>
                <div className="relative h-2.5 rounded-full bg-panel-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    // largura mínima ~2.5% pra a cor da faixa aparecer mesmo em
                    // 0% (o cinza de "nada gasto" fica visível, não some).
                    style={{ width: `${Math.max(pctFill, 2.5)}%`, background: corPorPctMeta(pctReal) }}
                  />
                  {/* Marcador da meta: linha na posição do limite. Sem estouro
                      fica na ponta da barra; estourando, a barra (vermelha)
                      passa dele -- mostra visualmente o quanto excedeu. */}
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white/80 rounded-full"
                    style={{ left: `calc(${pctMarcador}% - 1px)` }}
                    title={`Meta: ${formatarMoeda(o.valor_orcado)}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-text-faint mt-1.5">
                  <span>
                    {formatarMoeda(o.valor_realizado)} de {formatarMoeda(o.valor_orcado)}{" "}
                    <strong className={estourou ? "text-red" : "text-text-dim"}>({pctReal}%)</strong>
                  </span>
                  <span className={estourou ? "text-red" : "text-text-dim"}>
                    {estourou ? `${formatarMoeda(-restante)} acima` : `Restam ${formatarMoeda(restante)}`}
                  </span>
                </div>
              </div>
            )
          })}
          {!!orcamentosDespesa.length && !segmentosFiltrados.length && (
            <p className="text-text-faint text-[12.5px] py-2">
              Nenhuma meta nesta faixa.{" "}
              <button onClick={() => setFiltroBanda(null)} className="text-accent hover:underline">
                Ver todas
              </button>
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
