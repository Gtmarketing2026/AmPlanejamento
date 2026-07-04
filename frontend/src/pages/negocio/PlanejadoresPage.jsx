import { useQuery } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useNegocio } from "../../context/NegocioContext"
import { listarPlanejadores } from "../../api/negocio"
import { formatarMoeda } from "../../lib/format"

const STATUS_VARIANT = { ativa: "on", congelada: "warn", cancelada: "off" }

export default function PlanejadoresPage() {
  const { entrarPlanejador } = useNegocio()
  const { data: planejadores, isLoading, error } = useQuery({
    queryKey: ["negocio-planejadores"],
    queryFn: listarPlanejadores,
  })

  return (
    <Stage
      eyebrow="Nível Negócio · Admin"
      title="Planejadores"
      description="Todos os profissionais da plataforma. O admin pode ver a carteira de qualquer um, sem precisar da senha dele — 'Ver carteira' troca o contexto no topo."
    >
      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {error && <p className="text-red text-sm">Não foi possível carregar os planejadores.</p>}
        {!isLoading && !error && (
          <Table>
            <Thead>
              <Th>Planejador</Th>
              <Th>Plano</Th>
              <Th>Clientes</Th>
              <Th>MRR contribuído</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {planejadores?.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-text-faint text-[11.5px] font-mono">{p.email}</div>
                  </Td>
                  <Td className="text-text-dim">{p.tipo_plano_atual || "—"}</Td>
                  <Td className="font-mono">{p.clientes_ativos}</Td>
                  <Td className="font-mono text-accent">{formatarMoeda(p.mrr_contribuido)}</Td>
                  <Td>
                    <Pill variant={STATUS_VARIANT[p.status] || "neutral"}>{p.status}</Pill>
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => entrarPlanejador({ id: p.id, nome: p.nome })}
                      disabled={p.status === "cancelada"}
                      className="text-accent text-[12px] hover:underline disabled:text-text-faint disabled:no-underline disabled:cursor-not-allowed"
                    >
                      Ver carteira →
                    </button>
                  </Td>
                </Tr>
              ))}
              {!planejadores?.length && (
                <Tr>
                  <Td colSpan={6} className="text-text-faint text-center py-6">
                    Nenhum planejador cadastrado ainda.
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
