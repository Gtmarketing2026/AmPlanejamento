import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import BarRow from "../../../components/ui/BarRow"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import { criarMinhaApolice, excluirMinhaApolice, obterMinhaProtecao } from "../../../api/patrimonio"
import { formatarData, formatarMoeda } from "../../../lib/format"

const TIPOS = {
  vida: "Seguro de vida",
  saude: "Plano de saúde",
  patrimonial: "Seguro patrimonial",
  outro: "Outro",
}

export default function ProtecaoTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ tipo: "vida", seguradora: "", valor_cobertura: "", premio_mensal: "", vencimento: "" })
  const [mostrarForm, setMostrarForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-protecao", token],
    queryFn: () => obterMinhaProtecao(token),
    enabled: !!token,
  })

  const criar = useMutation({
    mutationFn: () =>
      criarMinhaApolice(token, {
        tipo: form.tipo,
        seguradora: form.seguradora,
        valor_cobertura: Number(form.valor_cobertura),
        premio_mensal: form.premio_mensal ? Number(form.premio_mensal) : null,
        vencimento: form.vencimento || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-protecao", token] })
      setForm({ tipo: "vida", seguradora: "", valor_cobertura: "", premio_mensal: "", vencimento: "" })
      setMostrarForm(false)
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaApolice(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-protecao", token] }),
  })

  if (isLoading || !data) return <p className="text-text-faint text-sm">Carregando…</p>

  const pctCoberto = data.cobertura_recomendada > 0 ? Math.round((data.cobertura_atual / data.cobertura_recomendada) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <KpiStat label="Cobertura de vida atual" value={formatarMoeda(data.cobertura_atual)} deltaColor="accent" />
        <KpiStat
          label="Cobertura recomendada"
          value={formatarMoeda(data.cobertura_recomendada)}
          info="Estimativa de referência (múltiplo da sua renda mensal atual) — não substitui uma análise detalhada com seu planejador."
        />
      </div>

      {data.cobertura_recomendada > 0 && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Cobertura de vida — quanto você já tem vs. o recomendado
          </div>
          <BarRow
            label={formatarMoeda(data.cobertura_atual)}
            pct={pctCoberto}
            value={`${pctCoberto}%`}
            labelWidth="w-[110px]"
          />
          {pctCoberto < 100 && (
            <p className="text-text-faint text-[11.5px] mt-2">
              Faltam {formatarMoeda(Math.max(0, data.cobertura_recomendada - data.cobertura_atual))} de cobertura
              pra chegar na referência estimada.
            </p>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">Minhas apólices</div>
          {!mostrarForm && <Button onClick={() => setMostrarForm(true)}>+ Nova apólice</Button>}
        </div>

        {mostrarForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (form.seguradora.trim() && form.valor_cobertura) criar.mutate()
            }}
            className="border border-line rounded-[9px] p-4 mb-4"
          >
            <div className="flex gap-3 flex-wrap items-start">
              <div className="w-44">
                <Select label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPOS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <Field
                  label="Seguradora"
                  value={form.seguradora}
                  onChange={(e) => setForm((f) => ({ ...f, seguradora: e.target.value }))}
                  placeholder="ex: Porto Seguro"
                />
              </div>
              <div className="w-36">
                <Field
                  label="Valor de cobertura (R$)"
                  type="number"
                  value={form.valor_cobertura}
                  onChange={(e) => setForm((f) => ({ ...f, valor_cobertura: e.target.value }))}
                />
              </div>
              <div className="w-36">
                <Field
                  label="Prêmio mensal (R$)"
                  type="number"
                  value={form.premio_mensal}
                  onChange={(e) => setForm((f) => ({ ...f, premio_mensal: e.target.value }))}
                />
              </div>
              <div className="w-40">
                <Field
                  label="Vencimento"
                  type="date"
                  value={form.vencimento}
                  onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!form.seguradora.trim() || !form.valor_cobertura || criar.isPending}>
                {criar.isPending ? "Adicionando…" : "Adicionar apólice"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {!data.apolices.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            Nenhuma apólice cadastrada ainda.
          </p>
        )}
        {data.apolices.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
            <div>
              <div className="text-[13px] font-medium">
                {TIPOS[a.tipo]} · {a.seguradora}
              </div>
              <div className="text-text-faint text-[11px] font-mono">
                {formatarMoeda(a.valor_cobertura)} de cobertura
                {a.premio_mensal ? ` · ${formatarMoeda(a.premio_mensal)}/mês` : ""}
                {a.vencimento ? ` · vence ${formatarData(a.vencimento)}` : ""}
              </div>
            </div>
            <button onClick={() => excluir.mutate(a.id)} className="text-text-faint hover:text-red text-[12px]">
              Excluir
            </button>
          </div>
        ))}
      </Card>
    </div>
  )
}
