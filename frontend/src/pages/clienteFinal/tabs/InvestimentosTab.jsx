import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import {
  atualizarMeuInvestimento,
  criarMeuInvestimento,
  excluirMeuInvestimento,
  listarMeusInvestimentos,
  listarMinhasMetas,
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
const LIQUIDEZ_OPCOES = ["Diária", "D+1", "D+30", "D+90", "No vencimento", "Sem vencimento"]

const FORM_VAZIO = {
  tipo: "renda_fixa",
  nome_ativo: "",
  valor_aplicado: "",
  valor_atual: "",
  instituicao_nome: "",
  liquidez: "",
}

export default function InvestimentosTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(FORM_VAZIO)
  const [alocacoes, setAlocacoes] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [busca, setBusca] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroInstituicao, setFiltroInstituicao] = useState("")

  const { data: investimentos = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-investimentos", token],
    queryFn: () => listarMeusInvestimentos(token),
    enabled: !!token,
  })
  const { data: metas = [] } = useQuery({
    queryKey: ["cliente-eu-metas", token],
    queryFn: () => listarMinhasMetas(token),
    enabled: !!token,
  })

  function limparForm() {
    setForm(FORM_VAZIO)
    setAlocacoes([])
    setEditandoId(null)
    setMostrarForm(false)
  }

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        tipo: form.tipo,
        nome_ativo: form.nome_ativo,
        valor_aplicado: form.valor_aplicado ? Number(form.valor_aplicado) : null,
        valor_atual: form.valor_atual ? Number(form.valor_atual) : null,
        instituicao_nome: form.instituicao_nome || null,
        liquidez: form.liquidez || null,
        alocacoes: alocacoes
          .filter((a) => a.meta_id && a.valor_alocado)
          .map((a) => ({ meta_id: a.meta_id, valor_alocado: Number(a.valor_alocado) })),
      }
      return editandoId ? atualizarMeuInvestimento(token, editandoId, dados) : criarMeuInvestimento(token, dados)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-investimentos", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      limparForm()
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMeuInvestimento(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-investimentos", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
    },
  })

  function editar(inv) {
    setForm({
      tipo: inv.tipo,
      nome_ativo: inv.nome_ativo,
      valor_aplicado: inv.valor_aplicado ?? "",
      valor_atual: inv.valor_atual ?? "",
      instituicao_nome: inv.instituicao_nome || "",
      liquidez: inv.liquidez || "",
    })
    setAlocacoes(inv.alocacoes.map((a) => ({ meta_id: a.meta_id, valor_alocado: a.valor_alocado })))
    setEditandoId(inv.id)
    setMostrarForm(true)
  }

  function adicionarLinhaAlocacao() {
    setAlocacoes((a) => [...a, { meta_id: "", valor_alocado: "" }])
  }
  function atualizarLinhaAlocacao(i, campo, valor) {
    setAlocacoes((a) => a.map((linha, idx) => (idx === i ? { ...linha, [campo]: valor } : linha)))
  }
  function removerLinhaAlocacao(i) {
    setAlocacoes((a) => a.filter((_, idx) => idx !== i))
  }

  const totalAlocado = alocacoes.reduce((s, a) => s + (Number(a.valor_alocado) || 0), 0)
  const valorInvestimentoAtual = Number(form.valor_atual) || 0

  const instituicoesDisponiveis = useMemo(
    () => [...new Set(investimentos.map((i) => i.instituicao_nome).filter(Boolean))],
    [investimentos]
  )

  const investimentosFiltrados = investimentos.filter((i) => {
    if (busca && !i.nome_ativo.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroTipo && i.tipo !== filtroTipo) return false
    if (filtroInstituicao && i.instituicao_nome !== filtroInstituicao) return false
    return true
  })

  const total = investimentos.reduce((s, i) => s + Number(i.valor_atual || i.valor_aplicado || 0), 0)
  const porGrupo = { "Renda Fixa": 0, "Renda Variável": 0, Outros: 0 }
  investimentos.forEach((i) => {
    porGrupo[GRUPO[i.tipo]] += Number(i.valor_atual || i.valor_aplicado || 0)
  })
  const metaMensalTotal = metas
    .filter((m) => m.status !== "pausada")
    .reduce((s, m) => s + Number(m.aporte_mensal_meta || 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        <KpiStat label="Total investido" value={formatarMoeda(total)} deltaColor="accent" />
        <KpiStat label="Renda fixa" value={formatarMoeda(porGrupo["Renda Fixa"])} />
        <KpiStat label="Renda variável" value={formatarMoeda(porGrupo["Renda Variável"])} />
        <KpiStat
          label="Meta de investimento mensal"
          value={formatarMoeda(metaMensalTotal)}
          info="Soma do 'aporte mensal' definido em cada objetivo (aba Metas)."
        />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            {editandoId ? "Editar investimento" : "Novo investimento"}
          </div>
          {!mostrarForm && (
            <Button onClick={() => setMostrarForm(true)}>+ Novo investimento</Button>
          )}
        </div>
        {mostrarForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (form.nome_ativo.trim()) salvar.mutate()
            }}
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
                  label="Ativo"
                  value={form.nome_ativo}
                  onChange={(e) => setForm((f) => ({ ...f, nome_ativo: e.target.value }))}
                  placeholder="ex: Tesouro Selic 2029"
                />
              </div>
              <div className="w-40">
                <Field
                  label="Instituição"
                  value={form.instituicao_nome}
                  onChange={(e) => setForm((f) => ({ ...f, instituicao_nome: e.target.value }))}
                  placeholder="ex: XP, Nubank"
                />
              </div>
              <div className="w-36">
                <Select label="Liquidez" value={form.liquidez} onChange={(e) => setForm((f) => ({ ...f, liquidez: e.target.value }))}>
                  <option value="">—</option>
                  {LIQUIDEZ_OPCOES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
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

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
                  Alocar em objetivos (opcional)
                </span>
                <button type="button" onClick={adicionarLinhaAlocacao} className="text-accent text-[12px] hover:underline">
                  + adicionar objetivo
                </button>
              </div>
              {alocacoes.map((a, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <select
                    value={a.meta_id}
                    onChange={(e) => atualizarLinhaAlocacao(i, "meta_id", e.target.value)}
                    className="flex-1 bg-bg border border-line rounded-[9px] px-3 py-2 text-[12.5px] text-text outline-none focus:border-accent/60"
                  >
                    <option value="">Selecione o objetivo…</option>
                    {metas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={a.valor_alocado}
                    onChange={(e) => atualizarLinhaAlocacao(i, "valor_alocado", e.target.value)}
                    placeholder="R$"
                    className="w-28 bg-bg border border-line rounded-[9px] px-3 py-2 text-[12.5px] text-text outline-none focus:border-accent/60"
                  />
                  <button type="button" onClick={() => removerLinhaAlocacao(i)} className="text-text-faint hover:text-red text-[12px]">
                    ✕
                  </button>
                </div>
              ))}
              {alocacoes.length > 0 && valorInvestimentoAtual > 0 && (
                <p className="text-text-faint text-[11px]">
                  Alocado: {formatarMoeda(totalAlocado)} de {formatarMoeda(valorInvestimentoAtual)}
                  {totalAlocado > valorInvestimentoAtual && (
                    <span className="text-red"> — passou do valor do investimento</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!form.nome_ativo.trim() || salvar.isPending}>
                {salvar.isPending ? "Salvando…" : editandoId ? "Salvar alterações" : "Adicionar investimento"}
              </Button>
              <Button type="button" variant="ghost" onClick={limparForm}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <div className="flex gap-3 flex-wrap mb-4">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por ativo…"
            className="flex-1 min-w-[180px] bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/60"
          />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text outline-none focus:border-accent/60"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {instituicoesDisponiveis.length > 0 && (
            <select
              value={filtroInstituicao}
              onChange={(e) => setFiltroInstituicao(e.target.value)}
              className="bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text outline-none focus:border-accent/60"
            >
              <option value="">Todas as instituições</option>
              {instituicoesDisponiveis.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          )}
        </div>

        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && !investimentosFiltrados.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            {investimentos.length ? "Nenhum investimento encontrado com esse filtro." : "Nenhum investimento cadastrado — comece adicionando acima."}
          </p>
        )}
        {!!investimentosFiltrados.length && (
          <Table>
            <Thead>
              <Th>Ativo</Th>
              <Th>Tipo</Th>
              <Th>Instituição</Th>
              <Th>Liquidez</Th>
              <Th className="text-right">Atual</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {investimentosFiltrados.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <div>{i.nome_ativo}</div>
                    {i.alocacoes.length > 0 && (
                      <div className="text-text-faint text-[10.5px] mt-0.5">
                        {i.alocacoes.map((a) => `${a.meta_titulo}: ${formatarMoeda(a.valor_alocado)}`).join(" · ")}
                      </div>
                    )}
                  </Td>
                  <Td className="text-text-dim">{TIPOS[i.tipo]}</Td>
                  <Td className="text-text-dim">{i.instituicao_nome || "—"}</Td>
                  <Td className="text-text-dim">{i.liquidez || "—"}</Td>
                  <Td className="text-right font-mono text-accent">{formatarMoeda(i.valor_atual)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <button onClick={() => editar(i)} className="text-text-faint hover:text-text text-[12px] mr-3">
                      Editar
                    </button>
                    <button onClick={() => excluir.mutate(i.id)} className="text-red text-[12px] hover:underline">
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
