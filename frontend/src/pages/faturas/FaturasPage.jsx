import { useState, useEffect } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useFaturas } from "../../hooks/useFaturas"
import { formatarCiclo, formatarMoeda, statusFatura } from "../../lib/format"

export default function FaturasPage() {
  const { data: faturas, isLoading, error } = useFaturas()
  const [selecionadaId, setSelecionadaId] = useState(null)

  useEffect(() => {
    if (faturas?.length && !selecionadaId) setSelecionadaId(faturas[0].id)
  }, [faturas, selecionadaId])

  const detalhe = faturas?.find((f) => f.id === selecionadaId)

  return (
    <Stage eyebrow="Financeiro" title="Histórico de faturas" description="Todo o histórico de cobrança, com o detalhamento de clientes inclusos vs. extras em cada ciclo.">
      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {error && <p className="text-red text-sm">Não foi possível carregar as faturas.</p>}

      {!isLoading && !error && (
        <div className="grid grid-cols-[1.3fr_1fr] gap-6">
          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Faturas</div>
            <Table>
              <Thead>
                <Th>Ciclo</Th>
                <Th>Clientes</Th>
                <Th>Valor</Th>
                <Th>Status</Th>
              </Thead>
              <tbody>
                {faturas?.map((f) => {
                  const s = statusFatura(f.status)
                  return (
                    <Tr
                      key={f.id}
                      onClick={() => setSelecionadaId(f.id)}
                      className={`cursor-pointer ${selecionadaId === f.id ? "bg-panel" : ""}`}
                    >
                      <Td className="font-medium">{formatarCiclo(f.ciclo_referencia)}</Td>
                      <Td className="font-mono text-text-dim">
                        {f.clientes_inclusos_no_ciclo} + {f.clientes_extras_no_ciclo} extras
                      </Td>
                      <Td className="font-mono">{formatarMoeda(f.valor_total)}</Td>
                      <Td>
                        <Pill variant={s.variant}>{s.label}</Pill>
                      </Td>
                    </Tr>
                  )
                })}
                {!faturas?.length && (
                  <Tr>
                    <Td colSpan={4} className="text-text-faint text-center py-6">
                      Nenhuma fatura gerada ainda.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </Card>

          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
              Detalhe {detalhe ? `— ${formatarCiclo(detalhe.ciclo_referencia)}` : ""}
            </div>
            {!detalhe && <p className="text-text-faint text-sm">Selecione uma fatura na lista.</p>}
            {detalhe && (
              <>
                <div className="flex justify-between py-2 border-b border-line text-[13px]">
                  <span className="text-text-dim">Plano base</span>
                  <span className="font-mono">{formatarMoeda(detalhe.valor_base)}</span>
                </div>
                {detalhe.clientes_extras_no_ciclo > 0 && (
                  <div className="flex justify-between py-2 border-b border-line text-[13px]">
                    <span className="text-text-dim">
                      Clientes extras — {detalhe.clientes_extras_no_ciclo}×
                    </span>
                    <span className="font-mono">{formatarMoeda(detalhe.valor_extras)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2.5 text-[14px] font-semibold">
                  <span>Total</span>
                  <span className="font-mono text-accent">{formatarMoeda(detalhe.valor_total)}</span>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </Stage>
  )
}
