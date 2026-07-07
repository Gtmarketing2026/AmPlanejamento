import { useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import TabsAgrupadas from "../../components/ui/TabsAgrupadas"
import { meuPerfilCliente } from "../../api/clientes"
import { listarMinhasTarefas } from "../../api/patrimonio"
import FluxoTab from "./tabs/FluxoTab"
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

  const { data: tarefas = [] } = useQuery({
    queryKey: ["cliente-eu-tarefas", token],
    queryFn: () => listarMinhasTarefas(token),
    enabled: !!token,
  })
  const tarefasPendentes = tarefas.filter((t) => !t.concluido).length

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
                { value: "clareza", label: "Resumo Financeiro" },
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

      {tab === "fluxo" && <FluxoTab token={token} contexto={ctx} />}
      {tab === "lancamentos" && <LancamentosTab token={token} contexto={ctx} temCnpj={temCnpj} />}
      {tab === "orcamento" && <OrcamentoTab token={token} contexto={ctx} />}
      {tab === "clareza" && <ClarezaFinanceiraTab token={token} contexto={ctx} />}
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
