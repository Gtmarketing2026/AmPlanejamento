import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import BarRow from "../../components/ui/BarRow"
import Button from "../../components/ui/Button"
import TabsAgrupadas from "../../components/ui/TabsAgrupadas"
import { meuPerfilCliente, minhasCategorias, minhasTransacoes } from "../../api/clientes"
import { listarMinhasTarefas } from "../../api/patrimonio"
import { formatarMoeda } from "../../lib/format"
import { exportarCsv, exportarPdfViaImpressao } from "../../lib/exportar"
import LancamentosTab from "./tabs/LancamentosTab"
import MetasTab from "./tabs/MetasTab"
import OrcamentoTab from "./tabs/OrcamentoTab"
import DividasTab from "./tabs/DividasTab"
import InvestimentosTab from "./tabs/InvestimentosTab"
import PatrimonioTab from "./tabs/PatrimonioTab"
import MeuFuturoTab from "./tabs/MeuFuturoTab"
import ClarezaFinanceiraTab from "./tabs/ClarezaFinanceiraTab"
import ProtecaoTab from "./tabs/ProtecaoTab"
import TarefasTab from "./tabs/TarefasTab"
import ContasTab from "./tabs/ContasTab"
import SaudeFinanceiraCard from "./SaudeFinanceiraCard"

export default function ClienteDashboardPage() {
  const { token } = useOutletContext()
  const [tab, setTab] = useState("fluxo")
  const [contexto, setContexto] = useState("PF") // PF | PJ (controle da empresa)

  const { data: perfil } = useQuery({
    queryKey: ["cliente-eu-perfil", token],
    queryFn: () => meuPerfilCliente(token),
    enabled: !!token,
  })
  const temCnpj = !!perfil?.cnpj
  const ctx = temCnpj ? contexto : "PF"

  const { data: transacoes = [] } = useQuery({
    queryKey: ["cliente-eu-transacoes", token, { contexto: ctx }],
    queryFn: () => minhasTransacoes(token, { contexto: ctx }),
    enabled: !!token,
  })
  const { data: categorias } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  const { data: tarefas = [] } = useQuery({
    queryKey: ["cliente-eu-tarefas", token],
    queryFn: () => listarMinhasTarefas(token),
    enabled: !!token,
  })
  const tarefasPendentes = tarefas.filter((t) => !t.concluido).length

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

  function exportarFluxoCsv() {
    exportarCsv(
      "fluxo-de-caixa.csv",
      transacoes.map((t) => ({
        data: t.data,
        descricao: t.descricao,
        categoria: nomePorCategoria[t.categoria_id] || "Sem categoria",
        tipo: t.tipo,
        valor: t.valor,
      }))
    )
  }

  function exportarFluxoPdf() {
    const linhasGasto = gastoPorCategoria
      .map((c) => `<tr><td>${c.label}</td><td class="right">${formatarMoeda(c.valor)}</td></tr>`)
      .join("")
    exportarPdfViaImpressao(
      "Fluxo de caixa",
      `<p>Entradas: <strong>${formatarMoeda(entradas)}</strong> · Saídas: <strong>${formatarMoeda(
        saidas
      )}</strong></p>
       <table><thead><tr><th>Categoria</th><th class="right">Gasto</th></tr></thead><tbody>${linhasGasto}</tbody></table>`
    )
  }

  return (
    <div className="max-w-[1080px] mx-auto px-8 py-10">
      {temCnpj && (
        <div className="flex items-center gap-1 bg-panel border border-line rounded-[10px] p-1 w-fit mb-5">
          {[
            { v: "PF", label: "Pessoal" },
            { v: "PJ", label: `Empresa${perfil?.nome_pj ? ` · ${perfil.nome_pj}` : ""}` },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setContexto(o.v)}
              className={`px-4 py-2 rounded-[7px] text-[12.5px] font-semibold transition-colors ${
                ctx === o.v ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <SaudeFinanceiraCard token={token} />

      <div className="mb-5">
        <TabsAgrupadas
          grupos={[
            {
              label: "Visão geral",
              itens: [
                { value: "fluxo", label: "Fluxo de caixa" },
                { value: "clareza", label: "Clareza Financeira" },
                { value: "tarefas", label: "Tarefas", badge: tarefasPendentes },
              ],
            },
            {
              label: "Planejamento",
              itens: [
                { value: "orcamento", label: "Planejamento" },
                { value: "metas", label: "Metas" },
                { value: "futuro", label: "Meu Futuro" },
              ],
            },
            {
              label: "Patrimônio",
              itens: [
                { value: "investimentos", label: "Investimentos" },
                { value: "patrimonio", label: "Patrimônio" },
                { value: "dividas", label: "Dívidas" },
                { value: "protecao", label: "Proteção" },
              ],
            },
            {
              label: "Lançamentos",
              itens: [
                { value: "lancamentos", label: "Lançamentos" },
                { value: "contas", label: "Contas" },
              ],
            },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "fluxo" && (
        <>
          <div className="flex justify-end gap-2 mb-3">
            <Button variant="ghost" onClick={exportarFluxoPdf} disabled={!transacoes.length}>
              Exportar PDF
            </Button>
            <Button variant="ghost" onClick={exportarFluxoCsv} disabled={!transacoes.length}>
              Exportar Excel/CSV
            </Button>
          </div>
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

      {tab === "lancamentos" && <LancamentosTab token={token} contexto={ctx} temCnpj={temCnpj} />}
      {tab === "orcamento" && <OrcamentoTab token={token} />}
      {tab === "clareza" && <ClarezaFinanceiraTab token={token} />}
      {tab === "metas" && <MetasTab token={token} />}
      {tab === "futuro" && <MeuFuturoTab token={token} />}
      {tab === "investimentos" && <InvestimentosTab token={token} />}
      {tab === "patrimonio" && <PatrimonioTab token={token} />}
      {tab === "dividas" && <DividasTab token={token} />}
      {tab === "protecao" && <ProtecaoTab token={token} />}
      {tab === "tarefas" && <TarefasTab token={token} />}
      {tab === "contas" && <ContasTab token={token} />}
    </div>
  )
}
