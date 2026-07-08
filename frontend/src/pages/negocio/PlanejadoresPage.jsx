import { Fragment, useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useEntrarComo } from "../../hooks/useEntrarComo"
import {
  atualizarCredenciaisPlanejador,
  atualizarStatusPlanejador,
  concederTrial,
  concederVagas,
  excluirPlanejadorNegocio,
  listarPlanejadores,
} from "../../api/negocio"
import { formatarData, formatarMoeda } from "../../lib/format"

export default function PlanejadoresPage() {
  const { entrarPlanejador, carregando } = useEntrarComo()
  const qc = useQueryClient()
  const { data: planejadores, isLoading, error } = useQuery({
    queryKey: ["negocio-planejadores"],
    queryFn: listarPlanejadores,
  })

  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ email: "", senha: "" })
  const [trialInputs, setTrialInputs] = useState({})
  const [filtroStatus, setFiltroStatus] = useState("todos") // todos|ativa|congelada|cancelada|trial
  const [filtroPlano, setFiltroPlano] = useState("todos") // todos|essencial|completo|sem
  const [busca, setBusca] = useState("")

  const atualizarCredenciais = useMutation({
    mutationFn: ({ id, dados }) => atualizarCredenciaisPlanejador(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-planejadores"] })
      setEditandoId(null)
    },
  })

  const atualizarStatus = useMutation({
    mutationFn: ({ id, status: novoStatus }) => atualizarStatusPlanejador(id, { status: novoStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["negocio-planejadores"] }),
  })

  const trial = useMutation({
    mutationFn: ({ id, trial_ate }) => concederTrial(id, { trial_ate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["negocio-planejadores"] }),
  })

  const [vagasInputs, setVagasInputs] = useState({}) // { [id]: { inclusas, extra } }
  const vagas = useMutation({
    mutationFn: ({ id, dados }) => concederVagas(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-planejadores"] })
      setEditVagasId(null)
    },
  })
  const [editVagasId, setEditVagasId] = useState(null)

  const excluir = useMutation({
    mutationFn: (id) => excluirPlanejadorNegocio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["negocio-planejadores"] }),
  })

  function onExcluirPlanejador(p) {
    const ok = window.confirm(
      `EXCLUIR PERMANENTEMENTE o planejador "${p.nome}" (${p.email})?\n\n` +
        `Isso apaga em cascata TODOS os clientes, lançamentos, importações e dados dele. ` +
        `NÃO dá pra desfazer.\n\nPra apenas suspender, use "cancelada" no status.`
    )
    if (ok) excluir.mutate(p.id)
  }

  function abrirVagas(p) {
    setEditVagasId((atual) => (atual === p.id ? null : p.id))
    setVagasInputs((f) => ({
      ...f,
      [p.id]: {
        inclusas: String(p.vagas_inclusas ?? 4),
        extra: p.valor_vaga_extra == null ? "" : String(p.valor_vaga_extra),
      },
    }))
  }

  function salvarVagas(id) {
    const v = vagasInputs[id] || {}
    const dados = {}
    if (v.inclusas !== "" && v.inclusas != null) dados.vagas_inclusas = Number(v.inclusas)
    // extra vazio = volta ao padrão do plano (null); número (incl. 0) = custom
    dados.valor_vaga_extra = v.extra === "" || v.extra == null ? null : Number(v.extra)
    vagas.mutate({ id, dados })
  }

  function onEditar(p) {
    setEditandoId((atual) => (atual === p.id ? null : p.id))
    setForm({ email: p.email, senha: "" })
    atualizarCredenciais.reset()
  }

  function onSalvar(e, id) {
    e.preventDefault()
    const dados = {}
    if (form.email) dados.email = form.email
    if (form.senha) dados.senha = form.senha
    if (Object.keys(dados).length === 0) return
    atualizarCredenciais.mutate({ id, dados })
  }

  function onConcederTrial(id) {
    const data = trialInputs[id]
    if (!data) return
    trial.mutate({ id, trial_ate: data })
  }

  const listaFiltrada = (planejadores || []).filter((p) => {
    if (filtroStatus === "trial" && !p.em_trial) return false
    if (["ativa", "congelada", "cancelada"].includes(filtroStatus) && p.status !== filtroStatus) return false
    if (filtroPlano === "sem" && p.tipo_plano_atual) return false
    if (["essencial", "completo"].includes(filtroPlano) && p.tipo_plano_atual !== filtroPlano) return false
    if (busca) {
      const q = busca.toLowerCase()
      if (!p.nome.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false
    }
    return true
  })

  const contagem = (planejadores || []).reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {})

  const OPCOES_STATUS = [
    { v: "todos", label: `Todos (${planejadores?.length || 0})` },
    { v: "ativa", label: `Ativos (${contagem.ativa || 0})` },
    { v: "trial", label: "Em teste" },
    { v: "congelada", label: `Congelados (${contagem.congelada || 0})` },
    { v: "cancelada", label: `Cancelados (${contagem.cancelada || 0})` },
  ]
  const OPCOES_PLANO = [
    { v: "todos", label: "Todos os planos" },
    { v: "essencial", label: "Essencial" },
    { v: "completo", label: "Completo" },
    { v: "sem", label: "Sem plano" },
  ]

  return (
    <Stage
      eyebrow="Nível Negócio · Admin"
      title="Planejadores"
      description="Todos os profissionais da plataforma — ativar, congelar, cancelar acesso, conceder período de teste. 'Entrar como' abre o app de verdade dele, sem precisar da senha."
    >
      {!isLoading && !error && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex gap-1 bg-panel border border-line rounded-[9px] p-1 flex-wrap">
            {OPCOES_STATUS.map((o) => (
              <button
                key={o.v}
                onClick={() => setFiltroStatus(o.v)}
                className={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium ${
                  filtroStatus === o.v ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={filtroPlano}
            onChange={(e) => setFiltroPlano(e.target.value)}
            className="bg-panel border border-line rounded-[9px] px-3 py-1.5 text-[12px] text-text-dim outline-none"
          >
            {OPCOES_PLANO.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome ou e-mail…"
            className="bg-panel border border-line rounded-[9px] px-3 py-1.5 text-[12px] text-text outline-none focus:border-accent/60 flex-1 min-w-[180px]"
          />
        </div>
      )}
      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {error && <p className="text-red text-sm">Não foi possível carregar os planejadores.</p>}
        {!isLoading && !error && (
          <Table>
            <Thead>
              <Th>Planejador</Th>
              <Th>Status</Th>
              <Th>Plano</Th>
              <Th>Clientes</Th>
              <Th>Vagas</Th>
              <Th>MRR</Th>
              <Th>Teste</Th>
              <Th>Ações</Th>
            </Thead>
            <tbody>
              {listaFiltrada.map((p) => (
                <Fragment key={p.id}>
                  <Tr>
                    <Td>
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-text-faint text-[11.5px] font-mono">{p.email}</div>
                    </Td>
                    <Td>
                      <select
                        value={p.status}
                        disabled={atualizarStatus.isPending}
                        onChange={(e) => atualizarStatus.mutate({ id: p.id, status: e.target.value })}
                        className="bg-panel border border-line rounded-[7px] px-2.5 py-1.5 text-[12px] text-text-dim outline-none focus:border-accent/60 disabled:opacity-50"
                      >
                        <option value="ativa">ativa</option>
                        <option value="congelada">congelada</option>
                        <option value="cancelada">cancelada</option>
                      </select>
                    </Td>
                    <Td className="text-text-dim">{p.tipo_plano_atual || "—"}</Td>
                    <Td className="font-mono">{p.clientes_ativos}</Td>
                    <Td>
                      <div className="text-[12px]">
                        <span className="font-mono">{p.vagas_inclusas ?? 4}</span>
                        <span className="text-text-faint"> incl.</span>
                      </div>
                      <div className="text-[10.5px] text-text-faint">
                        extra: {p.valor_vaga_extra == null ? "padrão do plano" : p.valor_vaga_extra === 0 ? "grátis" : `${formatarMoeda(p.valor_vaga_extra)}/mês`}
                      </div>
                      <button
                        onClick={() => abrirVagas(p)}
                        className="text-blue text-[11px] hover:underline mt-0.5"
                      >
                        gerenciar vagas
                      </button>
                    </Td>
                    <Td className="font-mono text-accent">{formatarMoeda(p.mrr_contribuido)}</Td>
                    <Td>
                      <div className="flex flex-col gap-1.5 min-w-[190px]">
                        {p.em_trial ? (
                          <span className="text-accent text-[12px]">até {formatarData(p.trial_ate)}</span>
                        ) : (
                          <span className="text-text-faint text-[12px]">—</span>
                        )}
                        <div className="flex gap-1 items-center">
                          <input
                            type="date"
                            className="bg-bg border border-line rounded px-2 py-1 text-[11px] text-text w-[130px]"
                            value={trialInputs[p.id] || ""}
                            onChange={(e) => setTrialInputs((f) => ({ ...f, [p.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => onConcederTrial(p.id)}
                            disabled={trial.isPending}
                            className="px-2 py-1 rounded text-[10.5px] font-mono border border-accent/40 text-accent hover:bg-accent/10"
                          >
                            conceder
                          </button>
                          {p.em_trial && (
                            <button
                              onClick={() => trial.mutate({ id: p.id, trial_ate: null })}
                              disabled={trial.isPending}
                              className="px-2 py-1 rounded text-[10.5px] font-mono border border-red/40 text-red hover:bg-red/10"
                            >
                              encerrar
                            </button>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <button
                        onClick={() => onEditar(p)}
                        className="text-blue text-[12px] hover:underline mr-3"
                      >
                        Editar login
                      </button>
                      <Link to={`/negocio/planejadores/${p.id}`} className="text-text-dim text-[12px] hover:underline mr-3">
                        Ver clientes
                      </Link>
                      <button
                        onClick={() => entrarPlanejador(p.id)}
                        disabled={p.status === "cancelada" || carregando}
                        className="text-accent text-[12px] hover:underline disabled:text-text-faint disabled:no-underline disabled:cursor-not-allowed mr-3"
                      >
                        Entrar como →
                      </button>
                      <button
                        onClick={() => onExcluirPlanejador(p)}
                        disabled={excluir.isPending}
                        className="text-red text-[12px] hover:underline"
                      >
                        Excluir
                      </button>
                    </Td>
                  </Tr>
                  {editandoId === p.id && (
                    <Tr className="bg-panel/40">
                      <Td colSpan={8}>
                        <form onSubmit={(e) => onSalvar(e, p.id)} className="flex items-end gap-3 py-1">
                          <div className="w-64">
                            <Field
                              label="E-mail de login"
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                          <div className="w-52">
                            <Field
                              label="Nova senha"
                              type="password"
                              value={form.senha}
                              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                              placeholder="8+ com letra e número (ou vazio)"
                            />
                          </div>
                          <Button type="submit" disabled={atualizarCredenciais.isPending} className="mb-3">
                            {atualizarCredenciais.isPending ? "Salvando…" : "Salvar"}
                          </Button>
                          <Button type="button" variant="ghost" className="mb-3" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                          {atualizarCredenciais.isError && (
                            <p className="text-red text-[12.5px] mb-3">{atualizarCredenciais.error.message}</p>
                          )}
                        </form>
                      </Td>
                    </Tr>
                  )}
                  {editVagasId === p.id && (
                    <Tr className="bg-panel/40">
                      <Td colSpan={8}>
                        <div className="flex items-end gap-4 py-1 flex-wrap">
                          <div>
                            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">Vagas inclusas (grátis)</div>
                            <input
                              type="number" min="0"
                              className="bg-bg border border-line rounded px-3 py-2 text-[13px] text-text w-28"
                              value={vagasInputs[p.id]?.inclusas ?? ""}
                              onChange={(e) => setVagasInputs((f) => ({ ...f, [p.id]: { ...f[p.id], inclusas: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">R$/mês por vaga extra</div>
                            <input
                              type="number" min="0" step="0.01"
                              placeholder="vazio = padrão do plano"
                              className="bg-bg border border-line rounded px-3 py-2 text-[13px] text-text w-52"
                              value={vagasInputs[p.id]?.extra ?? ""}
                              onChange={(e) => setVagasInputs((f) => ({ ...f, [p.id]: { ...f[p.id], extra: e.target.value } }))}
                            />
                          </div>
                          <Button onClick={() => salvarVagas(p.id)} disabled={vagas.isPending} className="mb-0.5">
                            {vagas.isPending ? "Salvando…" : "Salvar vagas"}
                          </Button>
                          <Button variant="ghost" onClick={() => setEditVagasId(null)} className="mb-0.5">Cancelar</Button>
                          <span className="text-text-faint text-[11px] mb-2">0 = extras grátis · vazio = usa o valor do plano</span>
                        </div>
                      </Td>
                    </Tr>
                  )}
                </Fragment>
              ))}
              {!listaFiltrada.length && (
                <Tr>
                  <Td colSpan={8} className="text-text-faint text-center py-6">
                    {planejadores?.length ? "Nenhum planejador com esse filtro." : "Nenhum planejador cadastrado ainda."}
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </Stage>
  )
}
