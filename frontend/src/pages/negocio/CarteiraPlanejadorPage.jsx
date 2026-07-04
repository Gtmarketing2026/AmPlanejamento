import { useEffect } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useNegocio } from "../../context/NegocioContext"
import { listarClientesDoPlanejador, listarPlanejadores } from "../../api/negocio"
import { formatarData, formatarMoeda, iniciais } from "../../lib/format"

export default function CarteiraPlanejadorPage() {
  const { planejadorId } = useParams()
  const { planejador, entrarCliente, sincronizarPlanejador } = useNegocio()

  const { data: planejadores } = useQuery({ queryKey: ["negocio-planejadores"], queryFn: listarPlanejadores })
  const { data: clientes, isLoading, error } = useQuery({
    queryKey: ["negocio-clientes", planejadorId],
    queryFn: () => listarClientesDoPlanejador(planejadorId),
    enabled: !!planejadorId,
  })

  // Deep-link/refresh: se o contexto não bate com a URL, backfill do nome a
  // partir da lista de planejadores já carregada.
  const p = planejadores?.find((x) => x.id === planejadorId)
  useEffect(() => {
    if (p && planejador?.id !== p.id) sincronizarPlanejador({ id: p.id, nome: p.nome })
  }, [p, planejador, sincronizarPlanejador])

  const nome = planejador?.nome || p?.nome || "Planejador"

  return (
    <Stage
      eyebrow="Nível Negócio → Planejador"
      title={`Carteira de ${nome}`}
      description="Clientes desse planejador, vistos pelo admin via bypass de RLS. Clique num cliente pra ver os lançamentos dele."
    >
      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {error && <p className="text-red text-sm">Não foi possível carregar a carteira.</p>}
        {!isLoading && !error && (
          <Table>
            <Thead>
              <Th>Cliente</Th>
              <Th>Tipo</Th>
              <Th>Cadastrado em</Th>
              <Th>Honorário mensal</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {clientes?.map((c) => (
                <Tr key={c.id} className="cursor-pointer hover:bg-panel" onClick={() => entrarCliente({ id: c.id, nome: c.nome })}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-panel border border-line flex items-center justify-center text-[11px] font-mono">
                        {iniciais(c.nome)}
                      </div>
                      {c.nome}
                    </div>
                  </Td>
                  <Td>{c.tipo}</Td>
                  <Td className="font-mono text-text-dim">{formatarData(c.data_cadastro)}</Td>
                  <Td className="font-mono text-text-dim">{formatarMoeda(c.valor_honorario_mensal)}</Td>
                  <Td>
                    <Pill variant={c.status === "ativo" ? "on" : "off"}>{c.status}</Pill>
                  </Td>
                  <Td className="text-right">
                    <span className="text-accent text-[12px]">ver lançamentos →</span>
                  </Td>
                </Tr>
              ))}
              {!clientes?.length && (
                <Tr>
                  <Td colSpan={6} className="text-text-faint text-center py-6">
                    Esse planejador ainda não tem clientes.
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
