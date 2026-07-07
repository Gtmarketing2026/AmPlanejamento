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

const TIPOS = {
  aposentadoria: "Aposentadoria",
  viagem: "Viagem",
  imovel: "Imóvel",
  quitar_divida: "Quitar dívida",
  reserva_emergencia: "Reserva de emergência",
  educacao: "Educação",
  outro: "Outro",
}
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
  const [tipo, setTipo] = useState("outro")
  const [prioridade, setPrioridade] = useState("desejo")
  const [valorAlvo, setValorAlvo] = useState("")
  const [prazo, setPrazo] = useState("")
  const [aporteAberto, setAporteAberto] = useState(null)
  const [valorAporte, setValorAporte] = useState("")
  const [metaMensalAberta, setMetaMensalAberta] = useState(null)
  const [valorMetaMensal, setValorMetaMensal] = useState("")
  const [novaMetaMensal, setNovaMetaMensal] = useState("")

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-metas", token],
    queryFn: () => listarMinhasMetas(token),
    enabled: !!token,
  })

  const criar = useMutation({
    mutationFn: () =>
      criarMinhaMeta(token, {
        titulo,
        tipo,
        prioridade,
        valor_alvo: valorAlvo ? Number(valorAlvo) : null,
        prazo: prazo || null,
        aporte_mensal_meta: novaMetaMensal ? Number(novaMetaMensal) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      setTitulo("")
      setValorAlvo("")
      setPrazo("")
      setNovaMetaMensal("")
    },
  })

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
  const totalPrioridade = (p) => porPrioridade(p).reduce((s, m) => s + Number(m.valor_alvo || m.valor_atual || 0), 0)

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Nova meta
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (titulo.trim()) criar.mutate()
          }}
        >
          <div className="flex gap-3 flex-wrap items-start">
            <div className="flex-1 min-w-[180px]">
              <Field
                label="Título"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="ex: Sair do aluguel"
              />
            </div>
            <div className="w-44">
              <Select label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {Object.entries(TIPOS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-48">
              <Select label="Prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
                {PRIORIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label} ({p.sub})
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-36">
              <Field
                label="Valor alvo (R$)"
                type="number"
                value={valorAlvo}
                onChange={(e) => setValorAlvo(e.target.value)}
                placeholder="50000"
              />
            </div>
            <div className="w-40">
              <Field label="Prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
            <div className="w-40">
              <Field
                label="Meta mensal (R$)"
                type="number"
                value={novaMetaMensal}
                onChange={(e) => setNovaMetaMensal(e.target.value)}
                placeholder="ex: 500"
              />
            </div>
          </div>
          <Button type="submit" disabled={!titulo.trim() || criar.isPending}>
            {criar.isPending ? "Criando…" : "Criar meta"}
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
                  <Td className="text-text-dim">{TIPOS[m.tipo]}</Td>
                  <Td className="text-right font-mono">{formatarMoeda(m.valor_alvo)}</Td>
                  <Td className="text-right font-mono">{formatarMoeda(m.valor_atual)}</Td>
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

              {porPrioridade(p.valor).map((m) => (
                <Card key={m.id}>
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="font-medium text-[13px]">{m.titulo}</span>
                    <div className="flex items-center gap-2">
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
                      label={formatarMoeda(m.valor_atual)}
                      pct={m.progresso_pct || 0}
                      value={`${m.progresso_pct || 0}%`}
                      labelWidth="w-[90px]"
                    />
                  ) : (
                    <div className="text-[12.5px] text-text-dim">Aportado: {formatarMoeda(m.valor_atual)}</div>
                  )}
                  {m.valor_investido_alocado > 0 && (
                    <div className="text-text-faint text-[11px] mt-1">
                      Investido: {formatarMoeda(m.valor_investido_alocado)}
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
              ))}
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
