import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import { Select } from "../../../components/ui/Field"
import { minhasCategorias, minhasTransacoes } from "../../../api/clientes"
import {
  atualizarMeuOrcamento,
  criarMeuOrcamento,
  excluirMeuOrcamento,
  listarMeusOrcamentos,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const CORES = ["#26D9A8", "#4C8DFF", "#F0A63C", "#E5645A", "#A78BFA", "#F472B6", "#38BDF8", "#FBBF24", "#34D399", "#94A3B8"]

function mesRefDe(t) {
  return (t.mes_referencia || t.data).slice(0, 7)
}

export default function OrcamentoTab({ token, contexto = "PF" }) {
  const qc = useQueryClient()
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [cenario, setCenario] = useState("com_metas") // atual | com_metas (destaque do resumo)
  const [categoriaId, setCategoriaId] = useState("")
  const [valorOrcado, setValorOrcado] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [valorEdicao, setValorEdicao] = useState("")

  const { data: categorias } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
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

  const mesRef = `${ano}-${String(mes).padStart(2, "0")}`
  const doMes = useMemo(() => transacoes.filter((t) => mesRefDe(t) === mesRef), [transacoes, mesRef])
  const renda = doMes.filter((t) => t.tipo === "entrada").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
  const gastosReais = doMes.filter((t) => t.tipo === "saida").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)

  const totalOrcado = orcamentos.reduce((s, o) => s + Number(o.valor_orcado), 0)
  const totalRealizado = orcamentos.reduce((s, o) => s + Number(o.valor_realizado), 0)

  // Segmentos coloridos por categoria orçada (pra barra empilhada).
  const segmentos = orcamentos.map((o, i) => ({ ...o, cor: CORES[i % CORES.length] }))
  const escala = Math.max(1, renda, gastosReais, totalOrcado)

  const sobraAtual = renda - gastosReais
  const sobraPlano = renda - totalOrcado
  const economia = gastosReais - totalOrcado // >0 = plano gasta menos que hoje

  const categoriasDisponiveis = (categorias || []).filter(
    (c) => c.tipo === "saida" && !orcamentos.some((o) => o.categoria_id === c.id)
  )

  const criar = useMutation({
    mutationFn: () => criarMeuOrcamento(token, { categoria_id: categoriaId, ano, mes, valor_orcado: Number(valorOrcado) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-orcamentos", token, ano, mes] })
      setCategoriaId("")
      setValorOrcado("")
    },
  })
  const editar = useMutation({
    mutationFn: (id) => atualizarMeuOrcamento(token, id, { valor_orcado: Number(valorEdicao) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-orcamentos", token, ano, mes] })
      setEditandoId(null)
    },
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirMeuOrcamento(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-orcamentos", token, ano, mes] }),
  })

  function BarraEmpilhada({ valorTotalLabel, itens }) {
    return (
      <div>
        <div className="flex h-6 rounded-[6px] overflow-hidden bg-panel-2 border border-line">
          {itens.map((it) => (
            <div
              key={it.categoria_id}
              style={{ width: `${(it.valor / escala) * 100}%`, background: it.cor }}
              title={`${it.categoria_nome}: ${formatarMoeda(it.valor)}`}
            />
          ))}
        </div>
        <div className="text-[11px] text-text-faint font-mono mt-1">{valorTotalLabel}</div>
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
        <KpiStat label="Renda do mês" value={formatarMoeda(renda)} deltaColor="accent" />
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

      {/* Comparação Atual x Com metas */}
      {orcamentos.length > 0 && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-4">
            Atual × Com metas · {MESES[mes - 1]}/{ano}
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[12px] text-text-dim mb-1.5">Renda</div>
              <div className="h-6 rounded-[6px] bg-accent/25 border border-accent/40 flex items-center px-2" style={{ width: `${(renda / escala) * 100}%`, minWidth: 60 }}>
                <span className="text-[11px] font-mono text-text">{formatarMoeda(renda)}</span>
              </div>
            </div>
            <div>
              <div className="text-[12px] text-text-dim mb-1.5">Gastos hoje (real)</div>
              <BarraEmpilhada
                valorTotalLabel={`Total gasto nas metas: ${formatarMoeda(totalRealizado)}`}
                itens={segmentos.map((s) => ({ ...s, valor: Number(s.valor_realizado) }))}
              />
            </div>
            <div>
              <div className="text-[12px] text-text-dim mb-1.5">Gastos planejados (com metas)</div>
              <BarraEmpilhada
                valorTotalLabel={`Total planejado: ${formatarMoeda(totalOrcado)}`}
                itens={segmentos.map((s) => ({ ...s, valor: Number(s.valor_orcado) }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4">
            {segmentos.map((s) => (
              <span key={s.categoria_id} className="flex items-center gap-1.5 text-[11.5px] text-text-dim">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.cor }} />
                {s.categoria_nome}
              </span>
            ))}
          </div>

          <div className="mt-4 bg-panel-2 rounded-[9px] px-4 py-3 text-[12.5px]">
            {economia > 0 ? (
              <>
                Seguindo seu plano você gastaria <strong className="text-accent">{formatarMoeda(economia)}</strong> a
                menos que hoje — sobrariam <strong className="text-accent">{formatarMoeda(sobraPlano)}</strong> no mês.
              </>
            ) : economia < 0 ? (
              <>
                Suas metas somam <strong className="text-amber">{formatarMoeda(-economia)}</strong> a mais do que você
                gastou de fato — dá pra apertar os limites.
              </>
            ) : (
              <>Seus gastos reais estão batendo com o plano. 👏</>
            )}
          </div>
        </Card>
      )}

      {/* Metas por categoria */}
      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Metas de gasto por categoria · {MESES[mes - 1]}/{ano}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (categoriaId && valorOrcado) criar.mutate()
          }}
          className="flex gap-3 flex-wrap items-end mb-4"
        >
          <div className="w-52">
            <Select label="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Selecione…</option>
              {categoriasDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
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

        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && !orcamentos.length && (
          <p className="text-text-faint text-[12.5px]">
            Nenhuma meta em {MESES[mes - 1]}/{ano} — adicione a primeira acima pra ver a comparação Atual × Com metas.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {segmentos.map((o) => {
            const pct = o.valor_orcado ? Math.min(100, Math.round((o.valor_realizado / o.valor_orcado) * 100)) : 0
            const estourou = Number(o.valor_realizado) > Number(o.valor_orcado)
            const restante = Number(o.valor_orcado) - Number(o.valor_realizado)
            return (
              <div key={o.id} className="border border-line rounded-[9px] px-3.5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2 font-medium text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: o.cor }} />
                    {o.categoria_nome}
                  </span>
                  <div className="flex items-center gap-3">
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
                <div className="h-2 rounded-full bg-panel-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: estourou ? "var(--color-red)" : o.cor }} />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-text-faint mt-1.5">
                  <span>{formatarMoeda(o.valor_realizado)} de {formatarMoeda(o.valor_orcado)}</span>
                  <span className={estourou ? "text-red" : "text-text-dim"}>
                    {estourou ? `${formatarMoeda(-restante)} acima` : `Restam ${formatarMoeda(restante)}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
