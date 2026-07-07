import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Pill from "../../../components/ui/Pill"
import { concluirMinhaTarefa, listarMinhasTarefas } from "../../../api/patrimonio"
import { formatarData } from "../../../lib/format"

function estaAtrasada(t) {
  if (!t.prazo || t.concluido) return false
  return new Date(t.prazo + "T00:00:00") < new Date(new Date().toDateString())
}

export default function TarefasTab({ token }) {
  const qc = useQueryClient()

  const { data: tarefas = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-tarefas", token],
    queryFn: () => listarMinhasTarefas(token),
    enabled: !!token,
  })

  const concluir = useMutation({
    mutationFn: ({ id, concluido }) => concluirMinhaTarefa(token, id, concluido),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-tarefas", token] }),
  })

  const pendentes = tarefas.filter((t) => !t.concluido)
  const concluidas = tarefas.filter((t) => t.concluido)
  const atrasadas = pendentes.filter(estaAtrasada)

  if (isLoading) return <p className="text-text-faint text-sm">Carregando…</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <KpiStat label="Tarefas pendentes" value={pendentes.length} />
        <KpiStat label="Atrasadas" value={atrasadas.length} deltaColor={atrasadas.length ? "red" : undefined} />
        <KpiStat label="Concluídas" value={concluidas.length} deltaColor="accent" />
      </div>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          O que seu planejador pediu
        </div>

        {!tarefas.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            Nenhuma tarefa por aqui ainda — quando seu planejador combinar algo com você, aparece nesta lista.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {[...pendentes, ...concluidas].map((t) => {
            const atrasada = estaAtrasada(t)
            return (
              <div key={t.id} className="flex items-center gap-3 border border-line rounded-[9px] px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={t.concluido}
                  onChange={() => concluir.mutate({ id: t.id, concluido: !t.concluido })}
                  className="accent-accent w-4 h-4"
                  title={t.concluido ? "Reabrir" : "Marcar como feita"}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[13.5px] font-medium ${t.concluido ? "text-text-faint line-through" : "text-text"}`}
                    >
                      {t.titulo}
                    </span>
                    {t.prazo && (
                      <span className={`text-[11px] font-mono ${atrasada ? "text-red" : "text-text-faint"}`}>
                        até {formatarData(t.prazo)}
                      </span>
                    )}
                    {atrasada && <Pill variant="off">atrasada</Pill>}
                    {t.concluido && <Pill variant="on">feita</Pill>}
                  </div>
                  {t.descricao && <div className="text-text-dim text-[12.5px] mt-0.5">{t.descricao}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
