import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import Pill from "../../../components/ui/Pill"
import BarRow from "../../../components/ui/BarRow"
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

export default function MetasTab({ token }) {
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState("")
  const [tipo, setTipo] = useState("outro")
  const [valorAlvo, setValorAlvo] = useState("")
  const [prazo, setPrazo] = useState("")
  const [aporteAberto, setAporteAberto] = useState(null)
  const [valorAporte, setValorAporte] = useState("")

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
        valor_alvo: valorAlvo ? Number(valorAlvo) : null,
        prazo: prazo || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      setTitulo("")
      setValorAlvo("")
      setPrazo("")
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaMeta(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] }),
  })

  const pausarOuRetomar = useMutation({
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
          </div>
          <Button type="submit" disabled={!titulo.trim() || criar.isPending}>
            {criar.isPending ? "Criando…" : "Criar meta"}
          </Button>
        </form>
      </Card>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !metas.length && (
        <p className="text-text-faint text-[12.5px]">Nenhuma meta cadastrada ainda.</p>
      )}

      {metas.map((m) => (
        <Card key={m.id}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[14px]">{m.titulo}</span>
                <Pill variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Pill>
              </div>
              <div className="text-text-faint text-[11.5px] font-mono">
                {TIPOS[m.tipo]}
                {m.prazo && ` · até ${formatarData(m.prazo)}`}
              </div>
            </div>
            <button
              onClick={() => excluir.mutate(m.id)}
              className="text-text-faint hover:text-red text-[11.5px]"
            >
              ✕
            </button>
          </div>

          {m.valor_alvo ? (
            <BarRow
              label={formatarMoeda(m.valor_atual)}
              pct={m.progresso_pct || 0}
              value={`${m.progresso_pct || 0}%`}
              labelWidth="w-[110px]"
            />
          ) : (
            <div className="text-[13px] text-text-dim">Total aportado: {formatarMoeda(m.valor_atual)}</div>
          )}
          {m.valor_alvo && (
            <div className="text-text-faint text-[11px] font-mono">Meta: {formatarMoeda(m.valor_alvo)}</div>
          )}

          <div className="flex items-center gap-2 mt-3">
            {aporteAberto === m.id ? (
              <>
                <input
                  type="number"
                  autoFocus
                  value={valorAporte}
                  onChange={(e) => setValorAporte(e.target.value)}
                  placeholder="Valor do aporte"
                  className="bg-bg border border-line rounded-[9px] px-3 py-2 text-[13px] text-text outline-none focus:border-accent/60 w-36"
                />
                <Button
                  onClick={() =>
                    valorAporte && aportar.mutate({ metaId: m.id, valor: Number(valorAporte) })
                  }
                  disabled={!valorAporte || aportar.isPending}
                >
                  Confirmar
                </Button>
                <Button variant="ghost" onClick={() => setAporteAberto(null)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setAporteAberto(m.id)}>
                  + Registrar aporte
                </Button>
                {m.status !== "concluida" && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      pausarOuRetomar.mutate({
                        id: m.id,
                        status: m.status === "pausada" ? "em_andamento" : "pausada",
                      })
                    }
                  >
                    {m.status === "pausada" ? "Retomar" : "Pausar"}
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
