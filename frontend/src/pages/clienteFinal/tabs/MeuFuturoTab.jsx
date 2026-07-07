import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field from "../../../components/ui/Field"
import SvgLineChart from "../../../components/ui/SvgLineChart"
import {
  criarMinhaSimulacao,
  excluirMinhaSimulacao,
  listarMinhasSimulacoes,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

function projetarValorFinal(patrimonioInicial, aporteMensal, taxaAnualPct, prazoAnos) {
  const i = taxaAnualPct / 100 / 12
  const n = prazoAnos * 12
  if (i === 0) return patrimonioInicial + aporteMensal * n
  const fator = Math.pow(1 + i, n)
  return patrimonioInicial * fator + aporteMensal * ((fator - 1) / i)
}

function curvaAnual(patrimonioInicial, aporteMensal, taxaAnualPct, prazoAnos) {
  const pontos = []
  for (let ano = 0; ano <= prazoAnos; ano++) {
    pontos.push(projetarValorFinal(patrimonioInicial, aporteMensal, taxaAnualPct, ano))
  }
  return pontos
}

export default function MeuFuturoTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    patrimonio_inicial: "0",
    aporte_mensal: "500",
    taxa_retorno_anual_pct: "8",
    prazo_anos: "30",
  })

  const { data: simulacoes = [] } = useQuery({
    queryKey: ["cliente-eu-simulacoes", token],
    queryFn: () => listarMinhasSimulacoes(token),
    enabled: !!token,
  })

  const salvar = useMutation({
    mutationFn: () =>
      criarMinhaSimulacao(token, {
        patrimonio_inicial: Number(form.patrimonio_inicial) || 0,
        aporte_mensal: Number(form.aporte_mensal) || 0,
        taxa_retorno_anual_pct: Number(form.taxa_retorno_anual_pct) || 0,
        prazo_anos: Number(form.prazo_anos) || 1,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-simulacoes", token] }),
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaSimulacao(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-simulacoes", token] }),
  })

  const params = {
    patrimonioInicial: Number(form.patrimonio_inicial) || 0,
    aporteMensal: Number(form.aporte_mensal) || 0,
    taxaAnual: Number(form.taxa_retorno_anual_pct) || 0,
    prazoAnos: Math.max(1, Number(form.prazo_anos) || 1),
  }

  const valorFinal = useMemo(
    () => projetarValorFinal(params.patrimonioInicial, params.aporteMensal, params.taxaAnual, params.prazoAnos),
    [params.patrimonioInicial, params.aporteMensal, params.taxaAnual, params.prazoAnos]
  )
  const curva = useMemo(
    () => curvaAnual(params.patrimonioInicial, params.aporteMensal, params.taxaAnual, params.prazoAnos),
    [params.patrimonioInicial, params.aporteMensal, params.taxaAnual, params.prazoAnos]
  )
  const anoAtual = new Date().getFullYear()
  const labels = [0, Math.floor(params.prazoAnos / 2), params.prazoAnos].map((a) => anoAtual + a)

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            Projeção de patrimônio
          </div>
          <div className="text-right">
            <div className="text-[11px] text-text-faint">valor projetado em {params.prazoAnos} anos</div>
            <div className="font-display text-xl font-semibold text-accent">{formatarMoeda(valorFinal)}</div>
          </div>
        </div>
        <SvgLineChart data={curva} labels={labels} color="#26D9A8" gradientId="meu-futuro-chart" />
      </Card>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Parâmetros da simulação
        </div>
        <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
          <Field
            label="Patrimônio inicial (R$)"
            type="number"
            value={form.patrimonio_inicial}
            onChange={set("patrimonio_inicial")}
          />
          <Field
            label="Aporte mensal (R$)"
            type="number"
            value={form.aporte_mensal}
            onChange={set("aporte_mensal")}
          />
          <Field
            label="Retorno anual (%)"
            type="number"
            step="0.1"
            value={form.taxa_retorno_anual_pct}
            onChange={set("taxa_retorno_anual_pct")}
          />
          <Field label="Prazo (anos)" type="number" value={form.prazo_anos} onChange={set("prazo_anos")} />
        </div>
        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar cenário"}
        </Button>
      </Card>

      {simulacoes.length > 0 && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Cenários salvos
          </div>
          <div className="flex flex-col gap-2">
            {simulacoes.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border border-line rounded-[9px] px-3.5 py-2.5"
              >
                <div>
                  <div className="text-[13px] font-medium">{s.nome_cenario}</div>
                  <div className="text-text-faint text-[11.5px] font-mono">
                    {formatarMoeda(s.aporte_mensal)}/mês · {s.taxa_retorno_anual_pct}% a.a. · {s.prazo_anos}{" "}
                    anos
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13.5px] text-accent">
                    {formatarMoeda(s.valor_final_projetado)}
                  </span>
                  <button
                    onClick={() => excluir.mutate(s.id)}
                    className="text-text-faint hover:text-red text-[11.5px]"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
