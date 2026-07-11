import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import Pill from "../../../components/ui/Pill"
import BarRow from "../../../components/ui/BarRow"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import {
  atualizarMinhaMeta,
  criarAporteMeta,
  criarMinhaMeta,
  excluirMinhaMeta,
  listarMinhasMetas,
} from "../../../api/patrimonio"
import { formatarData, formatarMoeda } from "../../../lib/format"

// Tipos de projeto (com ícone). O `tipo` é texto livre no backend, então além
// destes o cliente pode criar um tipo PERSONALIZADO (o nome digitado vira o
// próprio tipo). Ver picker no form.
const TIPOS = {
  viagem: { label: "Viagem", icone: "✈️" },
  veiculo: { label: "Veículo", icone: "🚗" },
  casa: { label: "Casa", icone: "🏠" },
  familia: { label: "Família", icone: "👪" },
  eletronico: { label: "Eletrônico", icone: "💻" },
  educacao: { label: "Educação", icone: "🎓" },
  hobby: { label: "Hobby", icone: "🎨" },
  profissional: { label: "Profissional", icone: "💼" },
  saude: { label: "Saúde", icone: "❤️" },
  aposentadoria: { label: "Aposentadoria", icone: "🌴" },
  imovel: { label: "Imóvel", icone: "🏢" },
  reserva_emergencia: { label: "Reserva de emergência", icone: "🛟" },
  quitar_divida: { label: "Quitar dívida", icone: "💳" },
  outro: { label: "Outro", icone: "🎯" },
}
// Rótulo/ícone de um tipo (inclui os personalizados: cai no texto livre).
const rotuloTipo = (t) => TIPOS[t]?.label || t || "Outro"
const iconeTipo = (t) => TIPOS[t]?.icone || "🎯"
const STATUS_VARIANT = { em_andamento: "warn", concluida: "on", pausada: "neutral" }
const STATUS_LABEL = { em_andamento: "em andamento", concluida: "concluída", pausada: "pausada" }

const PRIORIDADES = [
  { valor: "essencial", label: "Essencial", sub: "curto prazo" },
  { valor: "desejo", label: "Desejo", sub: "médio prazo" },
  { valor: "sonho", label: "Sonho", sub: "longo prazo" },
]

export default function MetasTab({ token }) {
  const qc = useQueryClient()
  const [visualizar, setVisualizar] = useState("prioridade") // prioridade | tabela | resumo
  const [titulo, setTitulo] = useState("")
  const [tipo, setTipo] = useState("viagem")
  const [tipoCustom, setTipoCustom] = useState("") // usado quando tipo === "__custom__"
  const [prioridade, setPrioridade] = useState("essencial")
  const [valorAlvo, setValorAlvo] = useState("")
  const [dataInicial, setDataInicial] = useState("")
  const [prazo, setPrazo] = useState("")
  const [aporteAberto, setAporteAberto] = useState(null)
  const [valorAporte, setValorAporte] = useState("")
  const [metaMensalAberta, setMetaMensalAberta] = useState(null)
  const [valorMetaMensal, setValorMetaMensal] = useState("")
  const [novaMetaMensal, setNovaMetaMensal] = useState("")
  const [editandoId, setEditandoId] = useState(null) // projeto sendo editado (lápis)

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-metas", token],
    queryFn: () => listarMinhasMetas(token),
    enabled: !!token,
  })

  function payloadProjeto() {
    return {
      titulo,
      tipo: tipo === "__custom__" ? tipoCustom.trim() || "outro" : tipo,
      prioridade,
      valor_alvo: valorAlvo ? Number(valorAlvo) : null,
      data_inicial: dataInicial || null,
      prazo: prazo || null,
      aporte_mensal_meta: novaMetaMensal ? Number(novaMetaMensal) : null,
    }
  }
  function limparForm() {
    setEditandoId(null)
    setTitulo("")
    setTipo("viagem")
    setTipoCustom("")
    setPrioridade("essencial")
    setValorAlvo("")
    setDataInicial("")
    setPrazo("")
    setNovaMetaMensal("")
  }
  const criar = useMutation({
    mutationFn: () => criarMinhaMeta(token, payloadProjeto()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      limparForm()
    },
  })
  const editar = useMutation({
    mutationFn: () => atualizarMinhaMeta(token, editandoId, payloadProjeto()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      limparForm()
    },
  })
  // Abre o form já preenchido pra editar um projeto existente (lápis no card).
  function abrirEdicao(m) {
    setEditandoId(m.id)
    setTitulo(m.titulo || "")
    const conhecido = TIPOS[m.tipo]
    setTipo(conhecido ? m.tipo : "__custom__")
    setTipoCustom(conhecido ? "" : m.tipo || "")
    setPrioridade(m.prioridade || "essencial")
    setValorAlvo(m.valor_alvo ? String(m.valor_alvo) : "")
    setDataInicial(m.data_inicial || "")
    setPrazo(m.prazo || "")
    setNovaMetaMensal(m.aporte_mensal_meta ? String(m.aporte_mensal_meta) : "")
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const atualizarMetaMensal = useMutation({
    mutationFn: ({ id, valor }) => atualizarMinhaMeta(token, id, { aporte_mensal_meta: valor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      setMetaMensalAberta(null)
      setValorMetaMensal("")
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaMeta(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] }),
  })

  const alternarAtiva = useMutation({
    mutationFn: ({ id, status }) => atualizarMinhaMeta(token, id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] }),
  })

  const aportar = useMutation({
    mutationFn: ({ metaId, valor }) => criarAporteMeta(token, metaId, { valor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      setAporteAberto(null)
      setValorAporte("")
    },
  })

  const porPrioridade = (p) => metas.filter((m) => m.prioridade === p)
  // Acumulado do projeto = aportes manuais + investimentos alocados a ele
  // (investimento vinculado ao projeto conta como aporte).
  const acumuladoDe = (m) => Number(m.valor_atual || 0) + Number(m.valor_investido_alocado || 0)
  const totalPrioridade = (p) => porPrioridade(p).reduce((s, m) => s + Number(m.valor_alvo || acumuladoDe(m)), 0)

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            {editandoId ? "Editar projeto" : "Novo projeto"}
          </div>
          {editandoId && (
            <button onClick={limparForm} className="text-text-faint hover:text-text text-[12px]">
              Cancelar edição
            </button>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!titulo.trim()) return
            editandoId ? editar.mutate() : criar.mutate()
          }}
          className="flex flex-col gap-4"
        >
          {/* Prioridade em chips */}
          <div>
            <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">Prioridade</div>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  onClick={() => setPrioridade(p.valor)}
                  className={`px-3 py-1.5 rounded-[9px] text-[12.5px] border transition-colors ${
                    prioridade === p.valor
                      ? "bg-accent text-[#062019] border-accent font-semibold"
                      : "border-line text-text-dim hover:text-text"
                  }`}
                >
                  {p.label} <span className="opacity-70">· {p.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tipo em grade de ícones + personalizado */}
          <div>
            <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">Tipo do projeto</div>
            <div className="flex gap-1.5 flex-wrap">
              {Object.entries(TIPOS).map(([v, info]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTipo(v)}
                  title={info.label}
                  className={`w-[74px] py-2 rounded-[10px] border flex flex-col items-center gap-1 transition-colors ${
                    tipo === v ? "border-accent bg-accent/10 text-text" : "border-line text-text-dim hover:text-text"
                  }`}
                >
                  <span className="text-[18px] leading-none">{info.icone}</span>
                  <span className="text-[10px] leading-tight text-center">{info.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTipo("__custom__")}
                title="Criar um tipo personalizado"
                className={`w-[74px] py-2 rounded-[10px] border flex flex-col items-center gap-1 transition-colors ${
                  tipo === "__custom__" ? "border-accent bg-accent/10 text-text" : "border-line text-text-dim hover:text-text"
                }`}
              >
                <span className="text-[18px] leading-none">➕</span>
                <span className="text-[10px] leading-tight text-center">Personalizado</span>
              </button>
            </div>
            {tipo === "__custom__" && (
              <div className="w-56 mt-2">
                <Field
                  label="Nome do tipo"
                  value={tipoCustom}
                  onChange={(e) => setTipoCustom(e.target.value)}
                  placeholder="ex: Casamento"
                />
              </div>
            )}
          </div>

          {/* Campos */}
          <div className="flex gap-3 flex-wrap items-start">
            <div className="flex-1 min-w-[180px]">
              <Field
                label="Nome do projeto"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="ex: Sair do aluguel"
              />
            </div>
            <div className="w-36">
              <Field
                label="Valor total (R$)"
                type="number"
                value={valorAlvo}
                onChange={(e) => setValorAlvo(e.target.value)}
                placeholder="50000"
              />
            </div>
            <div className="w-40">
              <Field label="Data inicial" type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
            </div>
            <div className="w-40">
              <Field label="Prazo (data alvo)" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div className="w-40">
              <Field
                label="Aporte mensal (R$)"
                type="number"
                value={novaMetaMensal}
                onChange={(e) => setNovaMetaMensal(e.target.value)}
                placeholder="ex: 500"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={!titulo.trim() || (tipo === "__custom__" && !tipoCustom.trim()) || criar.isPending || editar.isPending}
          >
            {editandoId
              ? editar.isPending
                ? "Salvando…"
                : "Salvar alterações"
              : criar.isPending
                ? "Criando…"
                : "Criar projeto"}
          </Button>
        </form>
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-[13px] font-medium">Meus projetos</div>
        <div className="inline-flex gap-1 bg-panel border border-line rounded-[10px] p-1">
          {[
            { v: "prioridade", l: "Prioridade" },
            { v: "tabela", l: "Tabela" },
            { v: "resumo", l: "Resumo" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setVisualizar(o.v)}
              className={`px-3 py-1.5 rounded-[7px] text-[12px] font-semibold ${
                visualizar === o.v ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}

      {!isLoading && visualizar === "resumo" && (
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          {PRIORIDADES.map((p) => (
            <Card key={p.valor}>
              <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">
                {p.label} · {p.sub}
              </div>
              <div className="font-display text-lg font-semibold">{formatarMoeda(totalPrioridade(p.valor))}</div>
              <div className="text-text-faint text-[11.5px] mt-1">{porPrioridade(p.valor).length} meta(s)</div>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && visualizar === "tabela" && (
        <Card>
          <Table>
            <Thead>
              <Th>Prioridade</Th>
              <Th>Título</Th>
              <Th>Tipo</Th>
              <Th className="text-right">Alvo</Th>
              <Th className="text-right">Atual</Th>
              <Th className="text-right">Meta mensal</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {metas.map((m) => (
                <Tr key={m.id}>
                  <Td className="capitalize">{m.prioridade}</Td>
                  <Td>{m.titulo}</Td>
                  <Td className="text-text-dim">{iconeTipo(m.tipo)} {rotuloTipo(m.tipo)}</Td>
                  <Td className="text-right font-mono">{formatarMoeda(m.valor_alvo)}</Td>
                  <Td
                    className="text-right font-mono"
                    title={
                      m.valor_investido_alocado > 0
                        ? `Aportado ${formatarMoeda(m.valor_atual)} + investido ${formatarMoeda(m.valor_investido_alocado)}`
                        : undefined
                    }
                  >
                    {formatarMoeda(acumuladoDe(m))}
                  </Td>
                  <Td className="text-right font-mono text-text-dim">{formatarMoeda(m.aporte_mensal_meta)}</Td>
                  <Td>
                    <Pill variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Pill>
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => excluir.mutate(m.id)}
                      className="text-text-faint hover:text-red text-[12px]"
                    >
                      Excluir
                    </button>
                  </Td>
                </Tr>
              ))}
              {!metas.length && (
                <Tr>
                  <Td colSpan={8} className="text-text-faint text-center py-6">
                    Nenhuma meta cadastrada ainda.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {!isLoading && visualizar === "prioridade" && (
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          {PRIORIDADES.map((p) => (
            <div key={p.valor} className="flex flex-col gap-3">
              <Card>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[13.5px]">{p.label}</div>
                    <div className="text-text-faint text-[11px] font-mono">{p.sub}</div>
                  </div>
                  <div className="font-mono text-[13px]">{formatarMoeda(totalPrioridade(p.valor))}</div>
                </div>
              </Card>

              {porPrioridade(p.valor).map((m) => {
                // Acumulado do objetivo = aportes manuais + investimentos alocados
                // a ele. O % de progresso considera os dois (antes só contava os
                // aportes, então R$100 investidos ficavam de fora do 0%).
                const aportado = Number(m.valor_atual || 0)
                const investido = Number(m.valor_investido_alocado || 0)
                const acumulado = aportado + investido
                const pctTotal = m.valor_alvo ? Math.round((acumulado / Number(m.valor_alvo)) * 100) : 0
                return (
                <Card key={m.id}>
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="font-medium text-[13px] flex items-center gap-1.5">
                      <span>{iconeTipo(m.tipo)}</span>
                      {m.titulo}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => abrirEdicao(m)}
                        title="Editar projeto"
                        className="text-text-faint hover:text-text text-[12px]"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() =>
                          alternarAtiva.mutate({
                            id: m.id,
                            status: m.status === "pausada" ? "em_andamento" : "pausada",
                          })
                        }
                        title={m.status === "pausada" ? "Pausada — clique pra ativar" : "Ativa — clique pra pausar"}
                        className={`w-8 h-[18px] rounded-full relative transition-colors ${
                          m.status !== "pausada" ? "bg-accent" : "bg-line"
                        }`}
                      >
                        <span
                          className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all ${
                            m.status !== "pausada" ? "left-[17px]" : "left-[2px]"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => excluir.mutate(m.id)}
                        className="text-text-faint hover:text-red text-[11px]"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {m.prazo && (
                    <div className="text-text-faint text-[10.5px] font-mono mb-1.5">até {formatarData(m.prazo)}</div>
                  )}
                  {m.valor_alvo ? (
                    <BarRow
                      label={formatarMoeda(acumulado)}
                      pct={Math.min(100, pctTotal)}
                      value={`${pctTotal}%`}
                      labelWidth="w-[90px]"
                    />
                  ) : (
                    <div className="text-[12.5px] text-text-dim">Acumulado: {formatarMoeda(acumulado)}</div>
                  )}
                  {investido > 0 && (
                    <div className="text-text-faint text-[11px] mt-1">
                      Aportado: {formatarMoeda(aportado)} · Investido: {formatarMoeda(investido)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-text-faint text-[11px]">Meta mensal:</span>
                    {metaMensalAberta === m.id ? (
                      <>
                        <input
                          type="number"
                          autoFocus
                          value={valorMetaMensal}
                          onChange={(e) => setValorMetaMensal(e.target.value)}
                          placeholder="R$"
                          className="bg-bg border border-line rounded-[7px] px-2 py-1 text-[11.5px] text-text outline-none focus:border-accent/60 w-20"
                        />
                        <button
                          onClick={() =>
                            atualizarMetaMensal.mutate({ id: m.id, valor: Number(valorMetaMensal) || 0 })
                          }
                          className="text-accent text-[11px] hover:underline"
                        >
                          OK
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setMetaMensalAberta(m.id)
                          setValorMetaMensal(m.aporte_mensal_meta || "")
                        }}
                        className="text-text-dim hover:text-text text-[11px] font-mono underline decoration-dotted"
                      >
                        {m.aporte_mensal_meta ? formatarMoeda(m.aporte_mensal_meta) : "definir"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {aporteAberto === m.id ? (
                      <>
                        <input
                          type="number"
                          autoFocus
                          value={valorAporte}
                          onChange={(e) => setValorAporte(e.target.value)}
                          placeholder="Valor"
                          className="bg-bg border border-line rounded-[7px] px-2.5 py-1.5 text-[12px] text-text outline-none focus:border-accent/60 w-24"
                        />
                        <button
                          onClick={() =>
                            valorAporte && aportar.mutate({ metaId: m.id, valor: Number(valorAporte) })
                          }
                          className="text-accent text-[11.5px] hover:underline"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setAporteAberto(null)}
                          className="text-text-faint text-[11.5px] hover:underline"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setAporteAberto(m.id)}
                        className="text-text-faint hover:text-text text-[11.5px]"
                      >
                        + Aporte
                      </button>
                    )}
                  </div>
                </Card>
                )
              })}
              {!porPrioridade(p.valor).length && (
                <p className="text-text-faint text-[11.5px] text-center py-3">Nenhuma meta aqui ainda.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
