import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import {
  criarMeuInvestimento,
  excluirMeuInvestimento,
  listarMeusInvestimentos,
} from "../../../api/patrimonio"
import { formatarData, formatarMoeda } from "../../../lib/format"

const TIPOS = {
  acao: "Ação",
  fundo: "Fundo",
  fii: "FII",
  renda_fixa: "Renda fixa",
  tesouro_direto: "Tesouro Direto",
  previdencia: "Previdência",
  cripto: "Cripto",
  outro: "Outro",
}
const GRUPO = {
  renda_fixa: "Renda Fixa",
  tesouro_direto: "Renda Fixa",
  previdencia: "Renda Fixa",
  acao: "Renda Variável",
  fundo: "Renda Variável",
  fii: "Renda Variável",
  cripto: "Outros",
  outro: "Outros",
}

export default function InvestimentosTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ tipo: "renda_fixa", nome_ativo: "", valor_aplicado: "", valor_atual: "" })

  const { data: investimentos = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-investimentos", token],
    queryFn: () => listarMeusInvestimentos(token),
    enabled: !!token,
  })

  const criar = useMutation({
    mutationFn: () =>
      criarMeuInvestimento(token, {
        tipo: form.tipo,
        nome_ativo: form.nome_ativo,
        valor_aplicado: form.valor_aplicado ? Number(form.valor_aplicado) : null,
        valor_atual: form.valor_atual ? Number(form.valor_atual) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-investimentos", token] })
      setForm({ tipo: "renda_fixa", nome_ativo: "", valor_aplicado: "", valor_atual: "" })
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMeuInvestimento(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-investimentos", token] }),
  })

  const total = investimentos.reduce((s, i) => s + Number(i.valor_atual || i.valor_aplicado || 0), 0)
  const porGrupo = { "Renda Fixa": 0, "Renda Variável": 0, Outros: 0 }
  investimentos.forEach((i) => {
    porGrupo[GRUPO[i.tipo]] += Number(i.valor_atual || i.valor_aplicado || 0)
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        <KpiStat label="Total investido" value={formatarMoeda(total)} deltaColor="accent" />
        <KpiStat label="Renda fixa" value={formatarMoeda(porGrupo["Renda Fixa"])} />
        <KpiStat label="Renda variável" value={formatarMoeda(porGrupo["Renda Variável"])} />
        <KpiStat label="Outros" value={formatarMoeda(porGrupo.Outros)} />
      </div>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Novo investimento
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (form.nome_ativo.trim()) criar.mutate()
          }}
        >
          <div className="flex gap-3 flex-wrap items-start">
            <div className="w-44">
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
                label="Ativo"
                value={form.nome_ativo}
                onChange={(e) => setForm((f) => ({ ...f, nome_ativo: e.target.value }))}
                placeholder="ex: Tesouro Selic 2029"
              />
            </div>
            <div className="w-36">
              <Field
                label="Valor aplicado (R$)"
                type="number"
                value={form.valor_aplicado}
                onChange={(e) => setForm((f) => ({ ...f, valor_aplicado: e.target.value }))}
              />
            </div>
            <div className="w-36">
              <Field
                label="Valor atual (R$)"
                type="number"
                value={form.valor_atual}
                onChange={(e) => setForm((f) => ({ ...f, valor_atual: e.target.value }))}
              />
            </div>
          </div>
          <Button type="submit" disabled={!form.nome_ativo.trim() || criar.isPending}>
            {criar.isPending ? "Adicionando…" : "Adicionar investimento"}
          </Button>
        </form>
      </Card>

      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && !investimentos.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            Nenhum investimento cadastrado — comece adicionando acima.
          </p>
        )}
        {!!investimentos.length && (
          <Table>
            <Thead>
              <Th>Ativo</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Aplicado</Th>
              <Th className="text-right">Atual</Th>
              <Th>Referência</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {investimentos.map((i) => (
                <Tr key={i.id}>
                  <Td>{i.nome_ativo}</Td>
                  <Td className="text-text-dim">{TIPOS[i.tipo]}</Td>
                  <Td className="text-right font-mono">{formatarMoeda(i.valor_aplicado)}</Td>
                  <Td className="text-right font-mono text-accent">{formatarMoeda(i.valor_atual)}</Td>
                  <Td className="font-mono text-text-dim">{formatarData(i.data_referencia)}</Td>
                  <Td className="text-right">
                    <button
                      onClick={() => excluir.mutate(i.id)}
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
