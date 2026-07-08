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
  atualizarPlanoEtapa,
  atualizarTarefaCliente,
  criarFollowUp,
  criarInteracao,
  criarPlanoEtapa,
  criarTarefaCliente,
  enviarNotificacaoCliente,
  excluirFollowUp,
  excluirInteracao,
  excluirPlanoEtapa,
  excluirTarefaCliente,
  googleConectar,
  googleDesconectar,
  googleStatus,
  listarFollowUpsCliente,
  listarInteracoes,
  listarPlanoEtapas,
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

// ---------------------------------------------------------------------------
// Questionário resumido pra AJUDAR a classificar o perfil comportamental.
// É só um apoio: a sugestão preenche o campo, que continua totalmente editável.
// ---------------------------------------------------------------------------
const QUIZ_PERGUNTAS = [
  {
    q: "Se um investimento cai de valor, o cliente...",
    opcoes: [
      ["Vende com medo de perder mais", 1],
      ["Espera e observa antes de decidir", 2],
      ["Aproveita pra comprar mais barato", 3],
    ],
  },
  {
    q: "Quanto da renda ele consegue guardar por mês?",
    opcoes: [
      ["Quase nada", 1],
      ["Um pouco, com esforço", 2],
      ["Uma boa parte, com disciplina", 3],
    ],
  },
  {
    q: "O horizonte de planejamento dele é...",
    opcoes: [
      ["Curto — pensa mês a mês", 1],
      ["Médio — alguns anos à frente", 2],
      ["Longo — décadas, aposentadoria", 3],
    ],
  },
  {
    q: "Como ele encara dívidas?",
    opcoes: [
      ["Evita a todo custo", 1],
      ["Usa com cautela", 2],
      ["Usa de forma estratégica pra crescer", 3],
    ],
  },
  {
    q: "Conhecimento sobre finanças e investimentos?",
    opcoes: [
      ["Iniciante", 1],
      ["Intermediário", 2],
      ["Avançado", 3],
    ],
  },
]

function classificarPerfil(soma) {
  // 5 perguntas × (1..3) => 5 a 15.
  if (soma <= 8) return { rotulo: "Conservador", descricao: "prioriza segurança e evita riscos" }
  if (soma <= 12) return { rotulo: "Moderado", descricao: "equilibra segurança e crescimento" }
  return { rotulo: "Arrojado", descricao: "tolera mais risco em busca de retorno" }
}

function QuizPerfil({ onUsar }) {
  const [respostas, setRespostas] = useState({})
  const completo = Object.keys(respostas).length === QUIZ_PERGUNTAS.length
  const soma = Object.values(respostas).reduce((s, v) => s + v, 0)
  const sugestao = completo ? classificarPerfil(soma) : null

  return (
    <div className="border border-line rounded-[9px] p-4 mb-3 bg-panel/40">
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Ajuda pra classificar (opcional)
      </div>
      <div className="flex flex-col gap-3">
        {QUIZ_PERGUNTAS.map((p, i) => (
          <div key={i}>
            <div className="text-[12.5px] text-text-dim mb-1.5">{p.q}</div>
            <div className="flex flex-wrap gap-1.5">
              {p.opcoes.map(([label, valor]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setRespostas((r) => ({ ...r, [i]: valor }))}
                  className={`px-2.5 py-1.5 rounded-[7px] text-[11.5px] border transition-colors ${
                    respostas[i] === valor
                      ? "bg-accent text-[#062019] border-accent"
                      : "border-line text-text-dim hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {sugestao && (
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap bg-panel-2 rounded-[9px] px-3.5 py-3">
          <div className="text-[12.5px]">
            Sugestão: <strong className="text-accent">{sugestao.rotulo}</strong>{" "}
            <span className="text-text-faint">— {sugestao.descricao}</span>
          </div>
          <Button type="button" onClick={() => onUsar(sugestao.rotulo)}>
            Usar esta sugestão
          </Button>
        </div>
      )}
      {!completo && (
        <p className="text-text-faint text-[11.5px] mt-3">Responda as 5 pra ver a sugestão — você pode editar depois.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plano de ação — caminho visível "onde estou -> onde quero chegar" com
// etapas (mapeamento de tempo + ações) e status.
// ---------------------------------------------------------------------------
const STATUS_ETAPA = {
  a_fazer: { label: "A fazer", cor: "var(--color-line)", texto: "text-text-faint", pill: "neutral" },
  em_andamento: { label: "Em andamento", cor: "var(--color-amber)", texto: "text-amber", pill: "warn" },
  concluida: { label: "Concluída", cor: "var(--color-accent)", texto: "text-accent", pill: "on" },
}
const PROXIMO_STATUS = { a_fazer: "em_andamento", em_andamento: "concluida", concluida: "a_fazer" }

function NoMapa({ icone, titulo, sub, cor }) {
  return (
    <div className="flex flex-col items-center text-center min-w-[92px] max-w-[130px]">
      <div
        className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-[13px] bg-panel z-10"
        style={{ borderColor: cor }}
      >
        {icone}
      </div>
      <div className="text-[11.5px] font-medium mt-1.5 leading-tight">{titulo}</div>
      {sub && <div className="text-text-faint text-[10px] mt-0.5 leading-tight">{sub}</div>}
    </div>
  )
}

function PlanoAcaoCard({ clienteId, cliente, qc }) {
  const [novo, setNovo] = useState({ titulo: "", horizonte: "", descricao: "", status: "a_fazer" })

  const { data: etapas = [], isLoading } = useQuery({
    queryKey: ["crm-plano-etapas", clienteId],
    queryFn: () => listarPlanoEtapas(clienteId),
    enabled: !!clienteId,
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ["crm-plano-etapas", clienteId] })

  const criar = useMutation({
    mutationFn: () =>
      criarPlanoEtapa(clienteId, {
        titulo: novo.titulo,
        horizonte: novo.horizonte || null,
        descricao: novo.descricao || null,
        status: novo.status,
      }),
    onSuccess: () => {
      invalidar()
      setNovo({ titulo: "", horizonte: "", descricao: "", status: "a_fazer" })
    },
  })
  const mudarStatus = useMutation({
    mutationFn: ({ id, status }) => atualizarPlanoEtapa(id, { status }),
    onSuccess: invalidar,
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirPlanoEtapa(id),
    onSuccess: invalidar,
  })

  const concluidas = etapas.filter((e) => e.status === "concluida").length
  const progresso = etapas.length ? Math.round((concluidas / etapas.length) * 100) : 0

  return (
    <Card className="mb-5">
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Plano de ação — onde estou → onde quero chegar
      </div>

      {/* Mapa visual */}
      {etapas.length > 0 && (
        <div className="mb-5">
          <div className="relative overflow-x-auto pb-2">
            {/* linha de trás */}
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-line" />
            <div className="flex items-start gap-3 relative">
              <NoMapa
                icone="📍"
                titulo="Onde estou"
                sub={cliente?.situacao_atual || "situação atual"}
                cor="var(--color-blue)"
              />
              {etapas.map((e) => (
                <NoMapa
                  key={e.id}
                  icone={e.status === "concluida" ? "✓" : ""}
                  titulo={e.titulo}
                  sub={e.horizonte || STATUS_ETAPA[e.status]?.label}
                  cor={STATUS_ETAPA[e.status]?.cor || "var(--color-line)"}
                />
              ))}
              <NoMapa
                icone="🎯"
                titulo="Onde quero chegar"
                sub={cliente?.objetivo_principal || "objetivo principal"}
                cor="var(--color-accent)"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-panel-2 overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${progresso}%` }} />
            </div>
            <span className="text-text-faint text-[11px] font-mono">
              {concluidas}/{etapas.length} etapas · {progresso}%
            </span>
          </div>
        </div>
      )}

      {/* Form nova etapa */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (novo.titulo.trim()) criar.mutate()
        }}
        className="mb-4"
      >
        <div className="flex gap-3 flex-wrap items-start">
          <div className="flex-1 min-w-[200px]">
            <Field
              label="Etapa / ação"
              value={novo.titulo}
              onChange={(e) => setNovo((n) => ({ ...n, titulo: e.target.value }))}
              placeholder="ex: Formar reserva de emergência de 6 meses"
            />
          </div>
          <div className="w-44">
            <Field
              label="Horizonte de tempo"
              value={novo.horizonte}
              onChange={(e) => setNovo((n) => ({ ...n, horizonte: e.target.value }))}
              placeholder="ex: Próximos 3 meses"
            />
          </div>
          <div className="w-40">
            <Select
              label="Status"
              value={novo.status}
              onChange={(e) => setNovo((n) => ({ ...n, status: e.target.value }))}
            >
              {Object.entries(STATUS_ETAPA).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <Textarea
          label="Detalhes (opcional)"
          rows={2}
          value={novo.descricao}
          onChange={(e) => setNovo((n) => ({ ...n, descricao: e.target.value }))}
          placeholder="Como fazer, marcos intermediários, o que observar…"
        />
        <Button type="submit" disabled={!novo.titulo.trim() || criar.isPending}>
          {criar.isPending ? "Adicionando…" : "Adicionar etapa"}
        </Button>
      </form>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !etapas.length && (
        <p className="text-text-faint text-[12.5px]">
          Nenhuma etapa ainda — monte o caminho do cliente da situação atual até o objetivo.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {etapas.map((e) => {
          const meta = STATUS_ETAPA[e.status] || STATUS_ETAPA.a_fazer
          return (
            <div key={e.id} className="flex items-start gap-3 border border-line rounded-[9px] px-3.5 py-2.5">
              <button
                type="button"
                onClick={() => mudarStatus.mutate({ id: e.id, status: PROXIMO_STATUS[e.status] })}
                title="Clique pra mudar o status"
                className="w-3 h-3 rounded-full mt-1 shrink-0"
                style={{ background: meta.cor }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium">{e.titulo}</span>
                  {e.horizonte && <span className="text-text-faint text-[11px] font-mono">{e.horizonte}</span>}
                  <Pill variant={meta.pill}>{meta.label}</Pill>
                </div>
                {e.descricao && <div className="text-text-dim text-[12px] mt-0.5">{e.descricao}</div>}
              </div>
              <button
                onClick={() => excluir.mutate(e.id)}
                className="text-text-faint hover:text-red text-[11.5px]"
                title="Excluir"
              >
                ✕
              </button>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function CrmPage() {
  const { data: clientes, isLoading } = useClientes()
  const atualizar = useAtualizarCliente()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [clienteId, setClienteId] = useState("")
  const [form, setForm] = useState({
    perfil_comportamental: "",
    objetivo_principal: "",
    historico: "",
    situacao_atual: "",
  })
  const [salvo, setSalvo] = useState(false)
  const [quizAberto, setQuizAberto] = useState(false)

  const cliente = clientes?.find((c) => c.id === clienteId)

  useEffect(() => {
    if (!clienteId && clientes?.length) setClienteId(clientes[0].id)
  }, [clientes, clienteId])
  useEffect(() => {
    if (cliente) {
      setForm({
        perfil_comportamental: cliente.perfil_comportamental || "",
        objetivo_principal: cliente.objetivo_principal || "",
        historico: cliente.historico || "",
        situacao_atual: cliente.situacao_atual || "",
      })
      setSalvo(false)
      setQuizAberto(false)
    }
  }, [cliente])

  async function onSalvar(e) {
    e.preventDefault()
    await atualizar.mutateAsync({
      id: clienteId,
      dados: {
        perfil_comportamental: form.perfil_comportamental || null,
        objetivo_principal: form.objetivo_principal || null,
        historico: form.historico || null,
        situacao_atual: form.situacao_atual || null,
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
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field
                        label="Perfil comportamental"
                        value={form.perfil_comportamental}
                        onChange={(e) => setForm((f) => ({ ...f, perfil_comportamental: e.target.value }))}
                        placeholder="ex: Cauteloso, Arrojado, Disciplinado"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuizAberto((v) => !v)}
                      className="mb-3 px-3 py-3 rounded-[9px] border border-line text-text-dim hover:text-text text-[12.5px] whitespace-nowrap"
                    >
                      {quizAberto ? "Fechar" : "Ajudar a classificar"}
                    </button>
                  </div>

                  {quizAberto && (
                    <QuizPerfil
                      onUsar={(perfil) => {
                        setForm((f) => ({ ...f, perfil_comportamental: perfil }))
                        setQuizAberto(false)
                      }}
                    />
                  )}

                  <Field
                    label="Objetivo principal (onde quero chegar)"
                    value={form.objetivo_principal}
                    onChange={(e) => setForm((f) => ({ ...f, objetivo_principal: e.target.value }))}
                    placeholder="ex: Aposentadoria aos 55, sair do aluguel"
                  />
                  <Textarea
                    label="Situação atual (onde estou)"
                    rows={2}
                    value={form.situacao_atual}
                    onChange={(e) => setForm((f) => ({ ...f, situacao_atual: e.target.value }))}
                    placeholder="ex: reserva de 3 meses formada, ainda pagando financiamento do carro"
                  />
                  <Textarea
                    label="Histórico do cliente"
                    rows={3}
                    value={form.historico}
                    onChange={(e) => setForm((f) => ({ ...f, historico: e.target.value }))}
                    placeholder="Contexto, como chegou, decisões importantes, mudanças de vida relevantes…"
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <Button type="submit" disabled={atualizar.isPending}>
                      {atualizar.isPending ? "Salvando…" : "Salvar perfil"}
                    </Button>
                    {salvo && <span className="text-accent text-[12.5px]">Perfil atualizado.</span>}
                  </div>
                </form>
              </Card>

              <PlanoAcaoCard clienteId={clienteId} cliente={cliente} qc={qc} />

              <GoogleAgendaCard
                searchParams={searchParams}
                setSearchParams={setSearchParams}
              />

              <MensagemCard clienteId={clienteId} />

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
// Mensagem direta pro cliente (aparece na aba Notificações dele)
// ---------------------------------------------------------------------------
function MensagemCard({ clienteId }) {
  const [titulo, setTitulo] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [enviado, setEnviado] = useState(false)

  const enviar = useMutation({
    mutationFn: () => enviarNotificacaoCliente(clienteId, { titulo, mensagem }),
    onSuccess: () => {
      setTitulo("")
      setMensagem("")
      setEnviado(true)
      setTimeout(() => setEnviado(false), 2500)
    },
  })

  return (
    <Card className="mb-5">
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Mandar mensagem pro cliente
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (titulo.trim() && mensagem.trim()) enviar.mutate()
        }}
      >
        <Field
          label="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="ex: Revisão do mês"
        />
        <Textarea
          label="Mensagem"
          rows={2}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Aparece na aba Notificações do painel do cliente."
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!titulo.trim() || !mensagem.trim() || enviar.isPending}>
            {enviar.isPending ? "Enviando…" : "Enviar"}
          </Button>
          {enviado && <span className="text-accent text-[12.5px]">Mensagem enviada.</span>}
        </div>
      </form>
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
