import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import Field, { Label, Select } from "../../components/ui/Field"
import { useAtualizarCliente, useClientes } from "../../hooks/useClientes"
import {
  atualizarFollowUp,
  atualizarTarefaCliente,
  criarFollowUp,
  criarInteracao,
  criarTarefaCliente,
  excluirFollowUp,
  excluirInteracao,
  excluirTarefaCliente,
  googleConectar,
  googleDesconectar,
  googleStatus,
  listarFollowUpsCliente,
  listarInteracoes,
  listarTarefasCliente,
} from "../../api/crm"
import { formatarData, iniciais } from "../../lib/format"

const TIPO_INTERACAO = {
  reuniao: { label: "Reunião", variant: "neutral" },
  mensagem: { label: "Mensagem", variant: "neutral" },
  nota: { label: "Nota", variant: "warn" },
  onboarding: { label: "Onboarding", variant: "on" },
  alerta_automatico: { label: "Alerta", variant: "off" },
}
const TIPOS_MANUAIS = ["reuniao", "mensagem", "nota", "onboarding"]

function Textarea({ label, className = "", ...props }) {
  return (
    <div className="mb-3">
      {label && <Label>{label}</Label>}
      <textarea
        className={`w-full bg-bg border border-line rounded-[9px] px-3.5 py-3 text-[13.5px] text-text placeholder:text-text-faint outline-none focus:border-accent/60 ${className}`}
        {...props}
      />
    </div>
  )
}

export default function CrmPage() {
  const { data: clientes, isLoading } = useClientes()
  const atualizar = useAtualizarCliente()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [clienteId, setClienteId] = useState("")
  const [form, setForm] = useState({ perfil_comportamental: "", objetivo_principal: "" })
  const [salvo, setSalvo] = useState(false)

  const cliente = clientes?.find((c) => c.id === clienteId)

  useEffect(() => {
    if (!clienteId && clientes?.length) setClienteId(clientes[0].id)
  }, [clientes, clienteId])
  useEffect(() => {
    if (cliente) {
      setForm({
        perfil_comportamental: cliente.perfil_comportamental || "",
        objetivo_principal: cliente.objetivo_principal || "",
      })
      setSalvo(false)
    }
  }, [cliente])

  async function onSalvar(e) {
    e.preventDefault()
    await atualizar.mutateAsync({
      id: clienteId,
      dados: {
        perfil_comportamental: form.perfil_comportamental || null,
        objetivo_principal: form.objetivo_principal || null,
      },
    })
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <Stage
      eyebrow="Relacionamento"
      title="CRM do profissional"
      description="Selecione um cliente, mantenha o perfil atualizado e registre interações e próximos contatos."
    >
      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !clientes?.length && (
        <Card>
          <p className="text-text-dim text-sm">
            Cadastre um cliente em <strong>Clientes</strong> pra começar a usar o CRM.
          </p>
        </Card>
      )}

      {!isLoading && clientes?.length > 0 && (
        <div className="max-w-2xl">
          <div className="mb-4">
            <Select label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>

          {cliente && (
            <>
              <Card className="mb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-full bg-panel border border-line flex items-center justify-center text-[12px] font-mono">
                    {iniciais(cliente.nome)}
                  </div>
                  <div>
                    <div className="font-medium">{cliente.nome}</div>
                    <div className="text-text-faint text-[11.5px] font-mono">
                      Cliente desde {formatarData(cliente.data_cadastro)}
                    </div>
                  </div>
                </div>

                <form onSubmit={onSalvar}>
                  <Field
                    label="Perfil comportamental"
                    value={form.perfil_comportamental}
                    onChange={(e) => setForm((f) => ({ ...f, perfil_comportamental: e.target.value }))}
                    placeholder="ex: Cauteloso, Arrojado, Disciplinado"
                  />
                  <Field
                    label="Objetivo principal"
                    value={form.objetivo_principal}
                    onChange={(e) => setForm((f) => ({ ...f, objetivo_principal: e.target.value }))}
                    placeholder="ex: Aposentadoria aos 55, sair do aluguel"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <Button type="submit" disabled={atualizar.isPending}>
                      {atualizar.isPending ? "Salvando…" : "Salvar perfil"}
                    </Button>
                    {salvo && <span className="text-accent text-[12.5px]">Perfil atualizado.</span>}
                  </div>
                </form>
              </Card>

              <GoogleAgendaCard
                searchParams={searchParams}
                setSearchParams={setSearchParams}
              />

              <TarefasCard clienteId={clienteId} qc={qc} />

              <FollowUpsCard clienteId={clienteId} qc={qc} />

              <TimelineCard clienteId={clienteId} qc={qc} />
            </>
          )}
        </div>
      )}
    </Stage>
  )
}

// ---------------------------------------------------------------------------
// Timeline de interações
// ---------------------------------------------------------------------------
function TimelineCard({ clienteId, qc }) {
  const [tipo, setTipo] = useState("reuniao")
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")

  const { data: interacoes = [], isLoading } = useQuery({
    queryKey: ["crm-interacoes", clienteId],
    queryFn: () => listarInteracoes(clienteId),
    enabled: !!clienteId,
  })

  const criar = useMutation({
    mutationFn: () => criarInteracao(clienteId, { tipo, titulo, descricao: descricao || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-interacoes", clienteId] })
      setTitulo("")
      setDescricao("")
    },
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirInteracao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-interacoes", clienteId] }),
  })

  return (
    <Card className="mb-5">
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Linha do tempo
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (titulo.trim()) criar.mutate()
        }}
        className="mb-5"
      >
        <div className="flex gap-3 flex-wrap">
          <div className="w-40">
            <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_MANUAIS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_INTERACAO[t].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Field
              label="Título"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="ex: Reunião de acompanhamento"
            />
          </div>
        </div>
        <Textarea
          label="Descrição (opcional)"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="O que foi conversado, decisões, próximos passos…"
        />
        <Button type="submit" disabled={!titulo.trim() || criar.isPending}>
          {criar.isPending ? "Registrando…" : "Registrar interação"}
        </Button>
      </form>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !interacoes.length && (
        <p className="text-text-faint text-[12.5px]">Nenhuma interação registrada ainda.</p>
      )}
      <div className="flex flex-col gap-3">
        {interacoes.map((it) => {
          const meta = TIPO_INTERACAO[it.tipo] || { label: it.tipo, variant: "neutral" }
          return (
            <div key={it.id} className="flex gap-3 border-l-2 border-line pl-3.5 py-0.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <Pill variant={meta.variant}>{meta.label}</Pill>
                  <span className="text-text-faint text-[11px] font-mono">
                    {formatarData(it.data_interacao)}
                  </span>
                  {it.ator_tipo === "sistema" && (
                    <span className="text-text-faint text-[10px] font-mono uppercase">auto</span>
                  )}
                </div>
                <div className="text-[13.5px] font-medium">{it.titulo}</div>
                {it.descricao && (
                  <div className="text-text-dim text-[12.5px] mt-0.5 whitespace-pre-line">
                    {it.descricao}
                  </div>
                )}
              </div>
              {it.ator_tipo !== "sistema" && (
                <button
                  onClick={() => excluir.mutate(it.id)}
                  className="text-text-faint hover:text-red text-[11.5px] self-start"
                  title="Excluir"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Tarefas do cliente (checklist)
// ---------------------------------------------------------------------------
function TarefasCard({ clienteId, qc }) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [prazo, setPrazo] = useState("")

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["crm-tarefas", clienteId],
    queryFn: () => listarTarefasCliente(clienteId),
    enabled: !!clienteId,
  })

  const criar = useMutation({
    mutationFn: () =>
      criarTarefaCliente(clienteId, { titulo, descricao: descricao || null, prazo: prazo || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-tarefas", clienteId] })
      setTitulo("")
      setDescricao("")
      setPrazo("")
    },
  })
  const concluir = useMutation({
    mutationFn: ({ id, concluido }) => atualizarTarefaCliente(id, { concluido }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tarefas", clienteId] }),
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirTarefaCliente(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tarefas", clienteId] }),
  })

  const pendentes = tarefas.filter((t) => !t.concluido)
  const concluidas = tarefas.filter((t) => t.concluido)

  return (
    <Card className="mb-5">
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Tarefas pro cliente
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (titulo.trim()) criar.mutate()
        }}
        className="mb-5"
      >
        <div className="flex gap-3 flex-wrap items-start">
          <div className="flex-1 min-w-[200px]">
            <Field
              label="Tarefa"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="ex: Investir R$500 na ação XPTO"
            />
          </div>
          <div className="w-44">
            <Field label="Prazo (opcional)" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>
        <Textarea
          label="Detalhes (opcional)"
          rows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="ex: aportar até o dia 10 pela corretora habitual"
        />
        <Button type="submit" disabled={!titulo.trim() || criar.isPending}>
          {criar.isPending ? "Adicionando…" : "Adicionar tarefa"}
        </Button>
      </form>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !tarefas.length && (
        <p className="text-text-faint text-[12.5px]">Nenhuma tarefa passada pro cliente ainda.</p>
      )}
      <div className="flex flex-col gap-2">
        {[...pendentes, ...concluidas].map((t) => (
          <div key={t.id} className="flex items-center gap-3 border border-line rounded-[9px] px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={t.concluido}
              onChange={() => concluir.mutate({ id: t.id, concluido: !t.concluido })}
              className="accent-accent"
              title={t.concluido ? "Reabrir" : "Marcar como concluída"}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-medium ${t.concluido ? "text-text-faint line-through" : "text-text"}`}>
                  {t.titulo}
                </span>
                {t.prazo && (
                  <span className="text-text-faint text-[11px] font-mono">até {formatarData(t.prazo)}</span>
                )}
                {t.concluido && <Pill variant="on">concluída</Pill>}
              </div>
              {t.descricao && <div className="text-text-dim text-[12px] mt-0.5">{t.descricao}</div>}
            </div>
            <button
              onClick={() => excluir.mutate(t.id)}
              className="text-text-faint hover:text-red text-[11.5px]"
              title="Excluir"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------
function FollowUpsCard({ clienteId, qc }) {
  const [dataPrevista, setDataPrevista] = useState("")
  const [observacao, setObservacao] = useState("")
  const [sincronizarGoogle, setSincronizarGoogle] = useState(false)

  const { data: gstatus } = useQuery({ queryKey: ["crm-google-status"], queryFn: googleStatus })
  const googleConectado = gstatus?.conectado

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ["crm-followups", clienteId],
    queryFn: () => listarFollowUpsCliente(clienteId),
    enabled: !!clienteId,
  })

  const criar = useMutation({
    mutationFn: () =>
      criarFollowUp(clienteId, {
        data_prevista: dataPrevista,
        observacao: observacao || null,
        sincronizar_google: sincronizarGoogle && googleConectado,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-followups", clienteId] })
      setDataPrevista("")
      setObservacao("")
    },
  })
  const concluir = useMutation({
    mutationFn: ({ id, concluido }) => atualizarFollowUp(id, { concluido }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-followups", clienteId] }),
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirFollowUp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-followups", clienteId] }),
  })

  // Edição inline de um follow-up (data/observação). A propagação pro Google
  // é feita no backend quando o follow-up já tem evento sincronizado.
  const [editandoId, setEditandoId] = useState(null)
  const [editData, setEditData] = useState("")
  const [editObs, setEditObs] = useState("")

  function abrirEdicao(f) {
    setEditandoId(f.id)
    setEditData(f.data_prevista)
    setEditObs(f.observacao || "")
  }

  const editar = useMutation({
    mutationFn: () =>
      atualizarFollowUp(editandoId, { data_prevista: editData, observacao: editObs || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-followups", clienteId] })
      setEditandoId(null)
    },
  })

  return (
    <Card className="mb-5">
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Próximos contatos (follow-ups)
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (dataPrevista) criar.mutate()
        }}
        className="mb-5"
      >
        <div className="flex gap-3 flex-wrap items-start">
          <div className="w-44">
            <Field
              label="Data prevista"
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Field
              label="Observação (opcional)"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="ex: Revisar orçamento do mês"
            />
          </div>
        </div>
        {googleConectado && (
          <label className="flex items-center gap-2 mb-3 text-[12.5px] text-text-dim cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sincronizarGoogle}
              onChange={(e) => setSincronizarGoogle(e.target.checked)}
              className="accent-accent"
            />
            Criar também um evento no Google Agenda
          </label>
        )}
        <Button type="submit" disabled={!dataPrevista || criar.isPending}>
          {criar.isPending ? "Agendando…" : "Agendar follow-up"}
        </Button>
      </form>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !followUps.length && (
        <p className="text-text-faint text-[12.5px]">Nenhum follow-up agendado.</p>
      )}
      <div className="flex flex-col gap-2">
        {followUps.map((f) =>
          editandoId === f.id ? (
            <form
              key={f.id}
              onSubmit={(e) => {
                e.preventDefault()
                if (editData) editar.mutate()
              }}
              className="border border-accent/40 rounded-[9px] px-3.5 py-3"
            >
              <div className="flex gap-3 flex-wrap items-start">
                <div className="w-44">
                  <Field
                    label="Data prevista"
                    type="date"
                    value={editData}
                    onChange={(e) => setEditData(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Field
                    label="Observação"
                    value={editObs}
                    onChange={(e) => setEditObs(e.target.value)}
                    placeholder="ex: Revisar orçamento do mês"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={!editData || editar.isPending}>
                  {editar.isPending ? "Salvando…" : "Salvar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditandoId(null)}>
                  Cancelar
                </Button>
                {f.sincronizado_google && (
                  <span className="text-text-faint text-[11.5px]">
                    A alteração também atualiza o evento no Google.
                  </span>
                )}
              </div>
            </form>
          ) : (
            <div
              key={f.id}
              className="flex items-center gap-3 border border-line rounded-[9px] px-3.5 py-2.5"
            >
              <input
                type="checkbox"
                checked={f.concluido}
                onChange={() => concluir.mutate({ id: f.id, concluido: !f.concluido })}
                className="accent-accent"
                title={f.concluido ? "Reabrir" : "Marcar como concluído"}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[13px] font-mono ${f.concluido ? "text-text-faint line-through" : "text-text"}`}
                  >
                    {formatarData(f.data_prevista)}
                  </span>
                  {f.sincronizado_google && <Pill variant="neutral">Google</Pill>}
                  {f.concluido && <Pill variant="on">concluído</Pill>}
                </div>
                {f.observacao && (
                  <div className="text-text-dim text-[12px] mt-0.5">{f.observacao}</div>
                )}
              </div>
              <button
                onClick={() => abrirEdicao(f)}
                className="text-text-faint hover:text-text text-[11.5px]"
                title="Editar"
              >
                ✎
              </button>
              <button
                onClick={() => excluir.mutate(f.id)}
                className="text-text-faint hover:text-red text-[11.5px]"
                title="Excluir"
              >
                ✕
              </button>
            </div>
          )
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Integração Google Agenda
// ---------------------------------------------------------------------------
function GoogleAgendaCard({ searchParams, setSearchParams }) {
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({
    queryKey: ["crm-google-status"],
    queryFn: googleStatus,
  })

  const retornoGoogle = searchParams.get("google")
  useEffect(() => {
    if (retornoGoogle) {
      qc.invalidateQueries({ queryKey: ["crm-google-status"] })
      // Limpa o parâmetro da URL depois de ler.
      const p = new URLSearchParams(searchParams)
      p.delete("google")
      setSearchParams(p, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retornoGoogle])

  const conectar = useMutation({
    mutationFn: googleConectar,
    onSuccess: (r) => {
      if (r?.url) window.location.href = r.url
    },
  })
  const desconectar = useMutation({
    mutationFn: googleDesconectar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-google-status"] }),
  })

  if (isLoading) return null

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[13.5px] font-medium mb-0.5">Google Agenda</div>
          {!status?.configurado && (
            <div className="text-text-faint text-[12px]">
              Integração não configurada no servidor.
            </div>
          )}
          {status?.configurado && status?.conectado && (
            <div className="text-text-dim text-[12px]">
              Conectado{status.email_google ? ` como ${status.email_google}` : ""} — follow-ups
              podem virar eventos na sua agenda.
            </div>
          )}
          {status?.configurado && !status?.conectado && (
            <div className="text-text-dim text-[12px]">
              Conecte sua conta Google pra espelhar os follow-ups na agenda.
            </div>
          )}
          {retornoGoogle === "erro" && (
            <div className="text-red text-[12px] mt-1">
              Não foi possível conectar ao Google. Tente novamente.
            </div>
          )}
          {retornoGoogle === "conectado" && status?.conectado && (
            <div className="text-accent text-[12px] mt-1">Conta Google conectada.</div>
          )}
        </div>
        {status?.configurado && (
          <div>
            {status.conectado ? (
              <Button
                variant="ghost"
                onClick={() => desconectar.mutate()}
                disabled={desconectar.isPending}
              >
                Desconectar
              </Button>
            ) : (
              <Button onClick={() => conectar.mutate()} disabled={conectar.isPending}>
                {conectar.isPending ? "Abrindo…" : "Conectar Google"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
