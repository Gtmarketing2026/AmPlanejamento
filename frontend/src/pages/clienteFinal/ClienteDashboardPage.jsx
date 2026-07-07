import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import BarRow from "../../components/ui/BarRow"
import Tabs from "../../components/ui/Tabs"
import SeletorCategoria from "../../components/ui/SeletorCategoria"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import {
  atualizarMinhaTransacao,
  minhasCategorias,
  minhasSubcategorias,
  minhasTransacoes,
} from "../../api/clientes"
import { formatarData, formatarMoeda } from "../../lib/format"
import MetasTab from "./tabs/MetasTab"
import DividasTab from "./tabs/DividasTab"
import InvestimentosTab from "./tabs/InvestimentosTab"
import PatrimonioTab from "./tabs/PatrimonioTab"
import MeuFuturoTab from "./tabs/MeuFuturoTab"

export default function ClienteDashboardPage() {
  const { token } = useOutletContext()
  const qc = useQueryClient()
  const [tab, setTab] = useState("fluxo")

  const { data: transacoes = [] } = useQuery({
    queryKey: ["cliente-eu-transacoes", token],
    queryFn: () => minhasTransacoes(token),
    enabled: !!token,
  })
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
  const atualizarTransacao = useMutation({
    mutationFn: ({ id, dados }) => atualizarMinhaTransacao(token, id, dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] }),
  })

  // Fluxo de caixa calculado dos lançamentos reais
  const entradas = transacoes.filter((t) => t.tipo === "entrada").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
  const saidas = transacoes.filter((t) => t.tipo === "saida").reduce((s, t) => s + Math.abs(Number(t.valor)), 0)
  const nomePorCategoria = Object.fromEntries((categorias || []).map((c) => [c.id, c.nome]))
  const gastoPorCategoria = Object.entries(
    transacoes
      .filter((t) => t.tipo === "saida")
      .reduce((acc, t) => {
        const nome = nomePorCategoria[t.categoria_id] || "Sem categoria"
        acc[nome] = (acc[nome] || 0) + Math.abs(Number(t.valor))
        return acc
      }, {})
  )
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor)
  const maxGasto = Math.max(1, ...gastoPorCategoria.map((g) => g.valor))

  return (
    <div className="max-w-[1080px] mx-auto px-8 py-10">
      <div className="mb-5">
        <Tabs
          options={[
            { value: "fluxo", n: "A", label: "Fluxo de caixa" },
            { value: "lancamentos", n: "B", label: "Lançamentos" },
            { value: "metas", n: "C", label: "Metas" },
            { value: "futuro", n: "D", label: "Meu Futuro" },
            { value: "investimentos", n: "E", label: "Investimentos" },
            { value: "patrimonio", n: "F", label: "Patrimônio" },
            { value: "dividas", n: "G", label: "Dívidas" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "fluxo" && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <KpiStat label="Entradas" value={formatarMoeda(entradas)} deltaColor="accent" />
            <KpiStat label="Saídas" value={formatarMoeda(saidas)} deltaColor="red" />
          </div>
          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
              Gasto por categoria
            </div>
            {gastoPorCategoria.length ? (
              gastoPorCategoria.map((c) => (
                <BarRow
                  key={c.label}
                  label={c.label}
                  pct={Math.round((c.valor / maxGasto) * 100)}
                  value={formatarMoeda(c.valor)}
                />
              ))
            ) : (
              <p className="text-text-faint text-sm">
                Sem lançamentos ainda — importe um extrato em <strong>Importar extrato</strong>.
              </p>
            )}
          </Card>
        </>
      )}

      {tab === "lancamentos" && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Lançamentos · você pode ajustar a categoria sugerida
          </div>
          <Table>
            <Thead>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Valor</Th>
            </Thead>
            <tbody>
              {transacoes.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-mono text-text-dim">{formatarData(t.data)}</Td>
                  <Td>{t.descricao}</Td>
                  <Td>
                    <SeletorCategoria
                      categoriaId={t.categoria_id}
                      subcategoriaId={t.subcategoria_id}
                      categorias={categorias}
                      subcategorias={subcategorias}
                      disabled={atualizarTransacao.isPending}
                      onChange={(dados) => atualizarTransacao.mutate({ id: t.id, dados })}
                    />
                  </Td>
                  <Td className={`text-right font-mono ${t.tipo === "entrada" ? "text-accent" : "text-red"}`}>
                    {t.tipo === "entrada" ? "+ " : "- "}
                    {formatarMoeda(Math.abs(Number(t.valor)))}
                  </Td>
                </Tr>
              ))}
              {!transacoes.length && (
                <Tr>
                  <Td colSpan={4} className="text-text-faint text-center py-6">
                    Nenhum lançamento ainda — importe um extrato em Importar extrato.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {tab === "metas" && <MetasTab token={token} />}
      {tab === "futuro" && <MeuFuturoTab token={token} />}
      {tab === "investimentos" && <InvestimentosTab token={token} />}
      {tab === "patrimonio" && <PatrimonioTab token={token} />}
      {tab === "dividas" && <DividasTab token={token} />}
    </div>
  )
}
