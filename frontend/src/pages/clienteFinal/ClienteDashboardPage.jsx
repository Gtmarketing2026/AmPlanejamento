import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import KpiStat from "../../components/ui/KpiStat"
import BarRow from "../../components/ui/BarRow"
import Button from "../../components/ui/Button"
import Tabs from "../../components/ui/Tabs"
import { minhasCategorias, minhasTransacoes } from "../../api/clientes"
import { listarMinhasTarefas, listarMinhasNotificacoes } from "../../api/patrimonio"
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
import NotificacoesTab from "./tabs/NotificacoesTab"
import ConfiguracoesTab from "./tabs/ConfiguracoesTab"
import SaudeFinanceiraCard from "./SaudeFinanceiraCard"

export default function ClienteDashboardPage() {
  const { token } = useOutletContext()
  const [tab, setTab] = useState("fluxo")

  const { data: transacoes = [] } = useQuery({
    queryKey: ["cliente-eu-transacoes", token, {}],
    queryFn: () => minhasTransacoes(token),
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
  const { data: notificacoes = [] } = useQuery({
    queryKey: ["cliente-eu-notificacoes", token],
    queryFn: () => listarMinhasNotificacoes(token),
    enabled: !!token,
  })
  const tarefasPendentes = tarefas.filter((t) => !t.concluido).length
  const notificacoesNaoLidas = notificacoes.filter((n) => !n.lida_cliente).length

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
      <SaudeFinanceiraCard token={token} />

      <div className="mb-5">
        <Tabs
          options={[
            { value: "fluxo", n: "A", label: "Fluxo de caixa" },
            { value: "lancamentos", n: "B", label: "Lançamentos" },
            { value: "orcamento", n: "C", label: "Orçamento" },
            { value: "clareza", n: "D", label: "Clareza Financeira" },
            { value: "metas", n: "E", label: "Metas" },
            { value: "futuro", n: "F", label: "Meu Futuro" },
            { value: "investimentos", n: "G", label: "Investimentos" },
            { value: "patrimonio", n: "H", label: "Patrimônio" },
            { value: "dividas", n: "I", label: "Dívidas" },
            { value: "protecao", n: "J", label: "Proteção" },
            { value: "tarefas", n: "K", label: "Tarefas", badge: tarefasPendentes },
            { value: "contas", n: "L", label: "Contas" },
            { value: "notificacoes", n: "M", label: "Notificações", badge: notificacoesNaoLidas },
            { value: "configuracoes", n: "N", label: "Configurações" },
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

      {tab === "lancamentos" && <LancamentosTab token={token} />}
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
      {tab === "notificacoes" && <NotificacoesTab token={token} />}
      {tab === "configuracoes" && <ConfiguracoesTab token={token} />}
    </div>
  )
}
