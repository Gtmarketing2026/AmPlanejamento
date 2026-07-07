import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import Pill from "../../../components/ui/Pill"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import {
  atualizarMinhaDivida,
  criarMinhaDivida,
  excluirMinhaDivida,
  listarMinhasDividas,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

const TIPOS = {
  emprestimo_pessoal: "Empréstimo pessoal",
  financiamento_imobiliario: "Financiamento imobiliário",
  financiamento_veiculo: "Financiamento de veículo",
  cartao_parcelado: "Cartão parcelado",
  cheque_especial: "Cheque especial",
  outro: "Outro",
}
const STATUS_VARIANT = { ativa: "warn", quitada: "on", atrasada: "off" }

export default function DividasTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    tipo: "emprestimo_pessoal",
    credor: "",
    valor_total: "",
    parcelas_totais: "",
  })

  const { data: dividas = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-dividas", token],
    queryFn: () => listarMinhasDividas(token),
    enabled: !!token,
  })

  const criar = useMutation({
    mutationFn: () =>
      criarMinhaDivida(token, {
        tipo: form.tipo,
        credor: form.credor,
        valor_total: Number(form.valor_total),
        parcelas_totais: form.parcelas_totais ? Number(form.parcelas_totais) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-dividas", token] })
      setForm({ tipo: "emprestimo_pessoal", credor: "", valor_total: "", parcelas_totais: "" })
    },
  })

  const marcarQuitada = useMutation({
    mutationFn: (d) => atualizarMinhaDivida(token, d.id, { status: "quitada", valor_pago: d.valor_total }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-dividas", token] }),
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaDivida(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-dividas", token] }),
  })

  const ativas = dividas.filter((d) => d.status !== "quitada")
  const saldoDevedorTotal = ativas.reduce((s, d) => s + Number(d.valor_restante), 0)
  const quitadas = dividas.filter((d) => d.status === "quitada")

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <KpiStat label="Saldo devedor total" value={formatarMoeda(saldoDevedorTotal)} deltaColor="red" />
        <KpiStat label="Dívidas ativas" value={ativas.length} />
        <KpiStat label="Dívidas quitadas" value={quitadas.length} deltaColor="accent" />
      </div>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Nova dívida / empréstimo
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (form.credor.trim() && form.valor_total) criar.mutate()
          }}
        >
          <div className="flex gap-3 flex-wrap items-start">
            <div className="w-52">
              <Select
                label="Tipo"
                value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
              >
                {Object.entries(TIPOS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <Field
                label="Credor"
                value={form.credor}
                onChange={(e) => setForm((f) => ({ ...f, credor: e.target.value }))}
                placeholder="ex: Itaú, Nubank"
              />
            </div>
            <div className="w-36">
              <Field
                label="Valor total (R$)"
                type="number"
                value={form.valor_total}
                onChange={(e) => setForm((f) => ({ ...f, valor_total: e.target.value }))}
              />
            </div>
            <div className="w-32">
              <Field
                label="Parcelas"
                type="number"
                value={form.parcelas_totais}
                onChange={(e) => setForm((f) => ({ ...f, parcelas_totais: e.target.value }))}
              />
            </div>
          </div>
          <Button type="submit" disabled={!form.credor.trim() || !form.valor_total || criar.isPending}>
            {criar.isPending ? "Adicionando…" : "Adicionar dívida"}
          </Button>
        </form>
      </Card>

      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && !dividas.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            Nenhum empréstimo cadastrado — cadastre acima pra acompanhar parcelas e saldo devedor.
          </p>
        )}
        {!!dividas.length && (
          <Table>
            <Thead>
              <Th>Credor</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Restante</Th>
              <Th>Parcelas</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {dividas.map((d) => (
                <Tr key={d.id}>
                  <Td>{d.credor}</Td>
                  <Td className="text-text-dim">{TIPOS[d.tipo]}</Td>
                  <Td className="text-right font-mono">{formatarMoeda(d.valor_total)}</Td>
                  <Td className="text-right font-mono text-red">{formatarMoeda(d.valor_restante)}</Td>
                  <Td className="font-mono text-text-dim">
                    {d.parcelas_pagas}/{d.parcelas_totais || "—"}
                  </Td>
                  <Td>
                    <Pill variant={STATUS_VARIANT[d.status]}>{d.status}</Pill>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {d.status !== "quitada" && (
                      <button
                        onClick={() => marcarQuitada.mutate(d)}
                        className="text-accent text-[12px] hover:underline mr-3"
                      >
                        Quitar
                      </button>
                    )}
                    <button
                      onClick={() => excluir.mutate(d.id)}
                      className="text-red text-[12px] hover:underline"
                    >
                      Excluir
                    </button>
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
