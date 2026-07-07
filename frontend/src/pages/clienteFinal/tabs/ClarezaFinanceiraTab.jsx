import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import { minhasCategorias, minhasTransacoes } from "../../../api/clientes"
import { listarMinhasContas } from "../../../api/contas"
import { formatarMoeda } from "../../../lib/format"
import { exportarCsv, exportarPdfViaImpressao } from "../../../lib/exportar"

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const FILTROS_VAZIO = { categoria_id: "", conta_conectada_id: "", data_inicio: "", data_fim: "" }

function primeiroDiaMes(ano, mes) {
  return `${ano}-${String(mes).padStart(2, "0")}-01`
}
function ultimoDiaMes(ano, mes) {
  const ultimo = new Date(ano, mes, 0).getDate()
  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`
}

export default function ClarezaFinanceiraTab({ token, contexto = "PF", onVerLancamentos }) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [f, setF] = useState(FILTROS_VAZIO)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const filtrosAtivos = Object.values(f).filter(Boolean).length

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-transacoes-todas", token, contexto],
    queryFn: () => minhasTransacoes(token, { contexto }),
    enabled: !!token,
  })
  const { data: categorias = [] } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  const { data: contas = [] } = useQuery({
    queryKey: ["cliente-eu-contas", token],
    queryFn: () => listarMinhasContas(token),
    enabled: !!token,
  })
  // Categorias neutras (movimentação interna) não somam no fluxo.
  const neutras = useMemo(
    () => new Set(categorias.filter((c) => c.tipo === "neutra").map((c) => c.id)),
    [categorias]
  )

  const porMes = useMemo(() => {
    const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, receitas: 0, despesas: 0 }))
    transacoes.forEach((t) => {
      if (neutras.has(t.categoria_id)) return
      if (f.categoria_id && t.categoria_id !== f.categoria_id) return
      if (f.conta_conectada_id && t.conta_conectada_id !== f.conta_conectada_id) return
      if (f.data_inicio && t.data < f.data_inicio) return
      if (f.data_fim && t.data > f.data_fim) return
      const [tAno, tMes] = t.data.split("-").map(Number)
      if (tAno !== ano) return
      const alvo = meses[tMes - 1]
      if (t.tipo === "entrada") alvo.receitas += Math.abs(Number(t.valor))
      else alvo.despesas += Math.abs(Number(t.valor))
    })
    return meses.map((m) => ({ ...m, resultado: m.receitas - m.despesas }))
  }, [transacoes, ano, neutras, f])

  const totalReceitas = porMes.reduce((s, m) => s + m.receitas, 0)
  const totalDespesas = porMes.reduce((s, m) => s + m.despesas, 0)
  const totalResultado = totalReceitas - totalDespesas

  function verLancamentosDoMes(mes, tipo) {
    if (!onVerLancamentos) return
    onVerLancamentos({
      tipo,
      data_inicio: primeiroDiaMes(ano, mes),
      data_fim: ultimoDiaMes(ano, mes),
      categoria_id: f.categoria_id || "",
      conta_conectada_id: f.conta_conectada_id || "",
    })
  }

  function exportarPlanilha() {
    exportarCsv(
      `resumo-financeiro-${ano}.csv`,
      porMes.map((m) => ({
        mes: MESES_ABREV[m.mes - 1],
        receitas: m.receitas.toFixed(2),
        despesas: m.despesas.toFixed(2),
        resultado: m.resultado.toFixed(2),
      }))
    )
  }

  function exportarPdf() {
    const linhas = porMes
      .map(
        (m) =>
          `<tr><td>${MESES_ABREV[m.mes - 1]}/${ano}</td><td class="right">${formatarMoeda(
            m.receitas
          )}</td><td class="right">${formatarMoeda(m.despesas)}</td><td class="right">${formatarMoeda(
            m.resultado
          )}</td></tr>`
      )
      .join("")
    exportarPdfViaImpressao(
      `Resumo Financeiro ${ano}`,
      `<table><thead><tr><th>Mês</th><th class="right">Receitas</th><th class="right">Despesas</th><th class="right">Resultado</th></tr></thead>
       <tbody>${linhas}<tr><td><strong>Total</strong></td><td class="right"><strong>${formatarMoeda(
         totalReceitas
       )}</strong></td><td class="right"><strong>${formatarMoeda(
        totalDespesas
      )}</strong></td><td class="right"><strong>${formatarMoeda(totalResultado)}</strong></td></tr></tbody></table>`
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="flex items-end gap-2">
          <Select label="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-28">
            {[hoje.getFullYear() - 2, hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <button
            onClick={() => setMostrarFiltros((v) => !v)}
            className={`px-3.5 py-2.5 rounded-[9px] border text-[13px] flex items-center gap-2 mb-3 ${
              filtrosAtivos ? "border-accent/60 text-accent" : "border-line text-text-dim hover:text-text"
            }`}
          >
            Filtros
            {filtrosAtivos > 0 && (
              <span className="text-[10px] font-mono rounded-full px-1.5 py-0.5 leading-none bg-accent/20 text-accent">
                {filtrosAtivos}
              </span>
            )}
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={exportarPdf}>
            Exportar PDF
          </Button>
          <Button variant="ghost" onClick={exportarPlanilha}>
            Exportar Excel/CSV
          </Button>
        </div>
      </div>

      {mostrarFiltros && (
        <div className="border border-line rounded-[9px] p-4 grid grid-cols-4 gap-3 max-md:grid-cols-1">
          <Select
            label="Categoria"
            value={f.categoria_id}
            onChange={(e) => setF((x) => ({ ...x, categoria_id: e.target.value }))}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
          <Select
            label="Conta / cartão"
            value={f.conta_conectada_id}
            onChange={(e) => setF((x) => ({ ...x, conta_conectada_id: e.target.value }))}
          >
            <option value="">Todas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_exibicao || (c.natureza === "cartao" ? "Cartão" : "Conta")}
                {c.natureza === "cartao" ? " (cartão)" : ""}
              </option>
            ))}
          </Select>
          <Field label="De" type="date" value={f.data_inicio} onChange={(e) => setF((x) => ({ ...x, data_inicio: e.target.value }))} />
          <Field label="Até" type="date" value={f.data_fim} onChange={(e) => setF((x) => ({ ...x, data_fim: e.target.value }))} />
          {filtrosAtivos > 0 && (
            <div className="col-span-4 max-md:col-span-1">
              <button onClick={() => setF(FILTROS_VAZIO)} className="text-text-faint hover:text-text text-[12px]">
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">Receitas</div>
          <div className="font-display text-lg font-semibold text-accent">{formatarMoeda(totalReceitas)}</div>
        </Card>
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">Despesas</div>
          <div className="font-display text-lg font-semibold text-red">{formatarMoeda(totalDespesas)}</div>
        </Card>
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">Resultado</div>
          <div className={`font-display text-lg font-semibold ${totalResultado >= 0 ? "text-accent" : "text-red"}`}>
            {formatarMoeda(totalResultado)}
          </div>
        </Card>
      </div>

      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && (
          <Table>
            <Thead>
              <Th>Mês</Th>
              <Th className="text-right">Receitas</Th>
              <Th className="text-right">Despesas</Th>
              <Th className="text-right">Resultado</Th>
            </Thead>
            <tbody>
              {porMes.map((m) => (
                <Tr key={m.mes}>
                  <Td className="font-mono text-text-dim">
                    {MESES_ABREV[m.mes - 1]}/{ano}
                  </Td>
                  <Td className="text-right font-mono text-accent">
                    {m.receitas > 0 && onVerLancamentos ? (
                      <button onClick={() => verLancamentosDoMes(m.mes, "entrada")} className="hover:underline">
                        {formatarMoeda(m.receitas)}
                      </button>
                    ) : (
                      formatarMoeda(m.receitas)
                    )}
                  </Td>
                  <Td className="text-right font-mono text-red">
                    {m.despesas > 0 && onVerLancamentos ? (
                      <button onClick={() => verLancamentosDoMes(m.mes, "saida")} className="hover:underline">
                        {formatarMoeda(m.despesas)}
                      </button>
                    ) : (
                      formatarMoeda(m.despesas)
                    )}
                  </Td>
                  <Td className={`text-right font-mono ${m.resultado >= 0 ? "text-text" : "text-red"}`}>
                    {formatarMoeda(m.resultado)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
