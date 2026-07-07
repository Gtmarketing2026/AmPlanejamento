import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import DonutMultiChart from "../../../components/ui/DonutMultiChart"
import {
  criarMeuBem,
  excluirMeuBem,
  listarMeusBens,
  obterMeuPatrimonio,
  obterMeuResumoPatrimonial,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

export default function PatrimonioTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ tipo: "movel", nome: "", valor: "" })

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-patrimonio", token],
    queryFn: () => obterMeuPatrimonio(token),
    enabled: !!token,
  })
  const { data: resumo } = useQuery({
    queryKey: ["cliente-eu-patrimonio-resumo", token],
    queryFn: () => obterMeuResumoPatrimonial(token),
    enabled: !!token,
  })
  const { data: bens = [] } = useQuery({
    queryKey: ["cliente-eu-bens", token],
    queryFn: () => listarMeusBens(token),
    enabled: !!token,
  })

  const criar = useMutation({
    mutationFn: () => criarMeuBem(token, { tipo: form.tipo, nome: form.nome, valor: Number(form.valor) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-bens", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-patrimonio", token] })
      setForm({ tipo: "movel", nome: "", valor: "" })
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMeuBem(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-bens", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-patrimonio", token] })
    },
  })

  if (isLoading) return <p className="text-text-faint text-sm">Carregando…</p>
  if (!data) return null

  const ativos = data.saldo_contas + data.total_investido + data.total_bens
  const bensMoveis = bens.filter((b) => b.tipo === "movel")
  const bensImoveis = bens.filter((b) => b.tipo === "imovel")

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

      {resumo && (ativos > 0 || resumo.passivos_dividas > 0) && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
              Resumo patrimonial
            </div>
            <div className="text-[12px] text-text-dim">
              <strong className="text-accent">{resumo.pct_ativo_gerador_renda}%</strong> dos seus ativos estão
              investidos (gerando renda)
            </div>
          </div>
          <DonutMultiChart
            centroLabel="Ativos"
            centroValor={formatarMoeda(ativos)}
            fatias={[
              { label: "Investimentos", valor: resumo.ativos_investimentos, cor: "#26D9A8" },
              { label: "Saldo em conta", valor: resumo.ativos_liquidez, cor: "#4C8DFF" },
              { label: "Bens móveis/imóveis", valor: resumo.ativos_bens, cor: "#F0A63C" },
            ]}
          />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Ativos
          </div>
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-[13px] text-text-dim">Saldo em conta (entradas − saídas)</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.saldo_contas)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-[13px] text-text-dim">Investimentos</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.total_investido)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[13px] text-text-dim">Bens móveis e imóveis</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.total_bens)}</span>
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

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Novo bem (móvel ou imóvel)
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (form.nome.trim() && form.valor) criar.mutate()
          }}
          className="flex gap-3 flex-wrap items-start"
        >
          <div className="w-36">
            <Select label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
              <option value="movel">Bem móvel</option>
              <option value="imovel">Imóvel</option>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Field
              label="Nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder={form.tipo === "imovel" ? "ex: Apartamento" : "ex: Carro Onix 2020"}
            />
          </div>
          <div className="w-36">
            <Field
              label="Valor (R$)"
              type="number"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!form.nome.trim() || !form.valor || criar.isPending}>
            Adicionar
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Bens móveis ({formatarMoeda(bensMoveis.reduce((s, b) => s + Number(b.valor), 0))})
          </div>
          {!bensMoveis.length && <p className="text-text-faint text-[12.5px]">Nenhum bem móvel cadastrado.</p>}
          {bensMoveis.map((b) => (
            <div key={b.id} className="flex justify-between items-center py-1.5">
              <span className="text-[13px]">{b.nome}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px]">{formatarMoeda(b.valor)}</span>
                <button onClick={() => excluir.mutate(b.id)} className="text-text-faint hover:text-red text-[11.5px]">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Bens imóveis ({formatarMoeda(bensImoveis.reduce((s, b) => s + Number(b.valor), 0))})
          </div>
          {!bensImoveis.length && <p className="text-text-faint text-[12.5px]">Nenhum imóvel cadastrado.</p>}
          {bensImoveis.map((b) => (
            <div key={b.id} className="flex justify-between items-center py-1.5">
              <span className="text-[13px]">{b.nome}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px]">{formatarMoeda(b.valor)}</span>
                <button onClick={() => excluir.mutate(b.id)} className="text-text-faint hover:text-red text-[11.5px]">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
