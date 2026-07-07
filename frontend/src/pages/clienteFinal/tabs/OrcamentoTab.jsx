import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import { Select } from "../../../components/ui/Field"
import BarRow from "../../../components/ui/BarRow"
import { minhasCategorias } from "../../../api/clientes"
import {
  atualizarMeuOrcamento,
  criarMeuOrcamento,
  excluirMeuOrcamento,
  listarMeusOrcamentos,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]

export default function OrcamentoTab({ token }) {
  const qc = useQueryClient()
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [categoriaId, setCategoriaId] = useState("")
  const [valorOrcado, setValorOrcado] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [valorEdicao, setValorEdicao] = useState("")

  const { data: categorias } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-orcamentos", token, ano, mes],
    queryFn: () => listarMeusOrcamentos(token, ano, mes),
    enabled: !!token,
  })

  const criar = useMutation({
    mutationFn: () =>
      criarMeuOrcamento(token, { categoria_id: categoriaId, ano, mes, valor_orcado: Number(valorOrcado) }),
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

  const categoriasDisponiveis = (categorias || []).filter(
    (c) => c.tipo === "saida" && !orcamentos.some((o) => o.categoria_id === c.id)
  )

  const totalOrcado = orcamentos.reduce((s, o) => s + Number(o.valor_orcado), 0)
  const totalRealizado = orcamentos.reduce((s, o) => s + Number(o.valor_realizado), 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Select label="Mês" value={mes} onChange={(e) => setMes(Number(e.target.value))} className="w-40">
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Select label="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-28">
          {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            Progresso geral do orçamento
          </div>
          <div className="text-[12.5px] font-mono text-text-dim">
            {formatarMoeda(totalRealizado)} / {formatarMoeda(totalOrcado)}
          </div>
        </div>
        <BarRow
          label=""
          pct={totalOrcado ? Math.round((totalRealizado / totalOrcado) * 100) : 0}
          value={totalOrcado ? `${Math.round((totalRealizado / totalOrcado) * 100)}%` : "—"}
          labelWidth="w-0"
        />
      </Card>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Adicionar meta de gasto por categoria
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (categoriaId && valorOrcado) criar.mutate()
          }}
          className="flex gap-3 flex-wrap items-end"
        >
          <div className="w-52">
            <Select label="Categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Selecione…</option>
              {categoriasDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40 mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">
              Valor orçado (R$)
            </div>
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
      </Card>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !orcamentos.length && (
        <p className="text-text-faint text-[12.5px]">
          Nenhuma meta de orçamento em {MESES[mes - 1]}/{ano} — adicione a primeira acima.
        </p>
      )}
      {orcamentos.map((o) => {
        const pct = o.valor_orcado ? Math.round((o.valor_realizado / o.valor_orcado) * 100) : 0
        const estourou = o.valor_realizado > o.valor_orcado
        return (
          <Card key={o.id}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[13.5px]">{o.categoria_nome}</span>
              <div className="flex items-center gap-3">
                {editandoId === o.id ? (
                  <>
                    <input
                      type="number"
                      autoFocus
                      value={valorEdicao}
                      onChange={(e) => setValorEdicao(e.target.value)}
                      className="w-28 bg-bg border border-line rounded-[9px] px-2.5 py-1.5 text-[12.5px] text-text outline-none focus:border-accent/60"
                    />
                    <button
                      onClick={() => editar.mutate(o.id)}
                      className="text-accent text-[12px] hover:underline"
                    >
                      Salvar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditandoId(o.id)
                      setValorEdicao(String(o.valor_orcado))
                    }}
                    className="text-text-faint hover:text-text text-[11.5px]"
                  >
                    Editar limite
                  </button>
                )}
                <button
                  onClick={() => excluir.mutate(o.id)}
                  className="text-text-faint hover:text-red text-[11.5px]"
                >
                  ✕
                </button>
              </div>
            </div>
            <BarRow
              label={formatarMoeda(o.valor_realizado)}
              pct={pct}
              value={`${pct}%`}
              labelWidth="w-[110px]"
            />
            <div className="text-text-faint text-[11px] font-mono flex items-center gap-2">
              Orçado: {formatarMoeda(o.valor_orcado)}
              {estourou && <span className="text-red">· acima do limite</span>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
