import { useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import Button from "../../components/ui/Button"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import {
  useAdminProfissionais,
  useAtualizarStatus,
  useConcederTrial,
} from "../../hooks/useAdminProfissionais"
import { formatarData } from "../../lib/format"

const STATUS_VARIANT = { ativa: "on", congelada: "warn", cancelada: "off" }

export default function AdminProfissionaisPage() {
  const { data: profissionais, isLoading, error } = useAdminProfissionais()
  const atualizarStatus = useAtualizarStatus()
  const concederTrial = useConcederTrial()
  const [trialInputs, setTrialInputs] = useState({})

  function onMudarStatus(id, status) {
    atualizarStatus.mutate({ id, status })
  }

  function onConcederTrial(id) {
    const data = trialInputs[id]
    if (!data) return
    concederTrial.mutate({ id, trial_ate: data })
  }

  function onEncerrarTrial(id) {
    concederTrial.mutate({ id, trial_ate: null })
  }

  return (
    <Stage eyebrow="Admin" title="Profissionais" description="Todos os profissionais da plataforma — ativar, congelar, cancelar acesso ou conceder período de teste.">
      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {error && <p className="text-red text-sm">Não foi possível carregar os profissionais.</p>}
        {!isLoading && !error && (
          <Table>
            <Thead>
              <Th>Profissional</Th>
              <Th>Status</Th>
              <Th>Plano</Th>
              <Th>Clientes</Th>
              <Th>Teste</Th>
              <Th>Ações</Th>
            </Thead>
            <tbody>
              {profissionais?.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-text-faint text-[11.5px] font-mono">{p.email}</div>
                  </Td>
                  <Td>
                    <Pill variant={STATUS_VARIANT[p.status] || "neutral"}>{p.status}</Pill>
                    {p.is_admin && <span className="ml-2 text-[10px] font-mono text-blue">admin</span>}
                  </Td>
                  <Td className="text-text-dim">{p.tipo_plano_atual || "—"}</Td>
                  <Td className="font-mono">{p.clientes_ativos}</Td>
                  <Td>
                    {p.em_trial ? (
                      <span className="text-accent text-[12px]">até {formatarData(p.trial_ate)}</span>
                    ) : (
                      <span className="text-text-faint text-[12px]">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <div className="flex gap-1">
                        {["ativa", "congelada", "cancelada"].map((s) => (
                          <button
                            key={s}
                            disabled={p.status === s || atualizarStatus.isPending}
                            onClick={() => onMudarStatus(p.id, s)}
                            className={`px-2 py-1 rounded text-[10.5px] font-mono border ${
                              p.status === s
                                ? "border-line text-text-faint opacity-40 cursor-default"
                                : "border-line text-text-dim hover:text-text hover:border-text-faint"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1 items-center">
                        <input
                          type="date"
                          className="bg-bg border border-line rounded px-2 py-1 text-[11px] text-text w-[130px]"
                          value={trialInputs[p.id] || ""}
                          onChange={(e) => setTrialInputs((f) => ({ ...f, [p.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => onConcederTrial(p.id)}
                          disabled={concederTrial.isPending}
                          className="px-2 py-1 rounded text-[10.5px] font-mono border border-accent/40 text-accent hover:bg-accent/10"
                        >
                          conceder
                        </button>
                        {p.em_trial && (
                          <button
                            onClick={() => onEncerrarTrial(p.id)}
                            disabled={concederTrial.isPending}
                            className="px-2 py-1 rounded text-[10.5px] font-mono border border-red/40 text-red hover:bg-red/10"
                          >
                            encerrar
                          </button>
                        )}
                      </div>
                    </div>
                  </Td>
                </Tr>
              ))}
              {!profissionais?.length && (
                <Tr>
                  <Td colSpan={6} className="text-text-faint text-center py-6">
                    Nenhum profissional cadastrado.
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
