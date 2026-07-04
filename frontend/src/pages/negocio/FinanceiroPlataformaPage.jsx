import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import Button from "../../components/ui/Button"
import Field, { Select } from "../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { criarDespesa, excluirDespesa, listarDespesas, listarFaturasPlataforma } from "../../api/negocio"
import { formatarCiclo, formatarMoeda, statusFatura } from "../../lib/format"

const CATEGORIAS = [
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "gateway_pagamento", label: "Gateway de pagamento" },
  { value: "open_finance", label: "Open Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "ferramentas", label: "Ferramentas" },
  { value: "pessoal", label: "Pessoal" },
  { value: "outro", label: "Outro" },
]

const FORM_VAZIO = { descricao: "", categoria: "infraestrutura", valor: "" }

export default function FinanceiroPlataformaPage() {
  const qc = useQueryClient()
  const { data: faturas } = useQuery({ queryKey: ["negocio-faturas"], queryFn: listarFaturasPlataforma })
  const { data: despesas } = useQuery({ queryKey: ["negocio-despesas"], queryFn: listarDespesas })

  const [form, setForm] = useState(FORM_VAZIO)
  const [erro, setErro] = useState(null)

  const criar = useMutation({
    mutationFn: criarDespesa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-despesas"] })
      qc.invalidateQueries({ queryKey: ["negocio-metricas"] })
      setForm(FORM_VAZIO)
    },
    onError: (e) => setErro(e.message),
  })
  const excluir = useMutation({
    mutationFn: excluirDespesa,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-despesas"] })
      qc.invalidateQueries({ queryKey: ["negocio-metricas"] })
    },
  })

  const totalDespesas = (despesas ?? []).reduce((s, d) => s + Number(d.valor), 0)

  function onSubmit(e) {
    e.preventDefault()
    setErro(null)
    if (!form.descricao || !form.valor) return
    criar.mutate({ descricao: form.descricao, categoria: form.categoria, valor: Number(form.valor) })
  }

  return (
    <Stage
      eyebrow="Nível Negócio · Admin"
      title="Financeiro da plataforma"
      description="Cobrança recebida dos planejadores (via Asaas) e custos de operar o próprio negócio Fluxo."
    >
      <div className="grid grid-cols-[1.2fr_1fr] gap-5">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Faturas recentes (todos os planejadores)
          </div>
          <Table>
            <Thead>
              <Th>Planejador</Th>
              <Th>Ciclo</Th>
              <Th>Valor</Th>
              <Th>Status</Th>
            </Thead>
            <tbody>
              {faturas?.map((f) => {
                const s = statusFatura(f.status)
                return (
                  <Tr key={f.id}>
                    <Td>{f.planejador_nome}</Td>
                    <Td className="font-mono text-text-dim">{formatarCiclo(f.ciclo_referencia)}</Td>
                    <Td className="font-mono">{formatarMoeda(f.valor_total)}</Td>
                    <Td>
                      <Pill variant={s.variant}>{s.label}</Pill>
                    </Td>
                  </Tr>
                )
              })}
              {!faturas?.length && (
                <Tr>
                  <Td colSpan={4} className="text-text-faint text-center py-6">
                    Nenhuma fatura gerada ainda.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Despesas operacionais
          </div>
          {despesas?.map((d) => (
            <div key={d.id} className="flex items-center justify-between py-2 border-b border-line last:border-0 group">
              <span className="text-[12.5px] text-text-dim">{d.descricao}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[12.5px]">{formatarMoeda(d.valor)}</span>
                <button
                  onClick={() => excluir.mutate(d.id)}
                  className="text-red text-[11px] opacity-0 group-hover:opacity-100 hover:underline"
                >
                  excluir
                </button>
              </div>
            </div>
          ))}
          {!despesas?.length && <p className="text-text-faint text-[12.5px] py-2">Nenhuma despesa registrada.</p>}
          {despesas?.length > 0 && (
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-line font-semibold">
              <span className="text-[12.5px]">Total</span>
              <span className="font-mono text-red">{formatarMoeda(totalDespesas)}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-4 pt-4 border-t border-line">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">
              Registrar despesa
            </div>
            <Field
              label="Descrição"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="ex: Assinatura Pluggy"
            />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Categoria" value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Field
                label="Valor"
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            {erro && <p className="text-red text-[12.5px] mb-2">{erro}</p>}
            <Button type="submit" variant="ghost" block disabled={criar.isPending}>
              {criar.isPending ? "Salvando…" : "+ Registrar despesa"}
            </Button>
          </form>
        </Card>
      </div>
    </Stage>
  )
}
