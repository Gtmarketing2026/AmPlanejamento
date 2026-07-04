import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useNegocio } from "../../context/NegocioContext"
import { listarTransacoesDoCliente } from "../../api/negocio"
import { formatarData, formatarMoeda } from "../../lib/format"

export default function ClienteNegocioPage() {
  const { clienteId } = useParams()
  const { cliente } = useNegocio()

  const { data: transacoes, isLoading, error } = useQuery({
    queryKey: ["negocio-transacoes", clienteId],
    queryFn: () => listarTransacoesDoCliente(clienteId),
    enabled: !!clienteId,
  })

  return (
    <Stage
      eyebrow="Nível Negócio → Planejador → Cliente"
      title={cliente?.nome ? `Lançamentos de ${cliente.nome}` : "Lançamentos do cliente"}
      description="Visão só de leitura do admin — os lançamentos desse cliente, via bypass de RLS."
    >
      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {error && <p className="text-red text-sm">Não foi possível carregar os lançamentos.</p>}
        {!isLoading && !error && (
          <>
            <Table>
              <Thead>
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th>Origem</Th>
                <Th className="text-right">Valor</Th>
              </Thead>
              <tbody>
                {transacoes?.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-mono text-text-dim">{formatarData(t.data)}</Td>
                    <Td>{t.descricao}</Td>
                    <Td className="text-text-dim">{t.origem === "cartao" ? "Cartão" : "Conta"}</Td>
                    <Td className={`text-right font-mono ${t.tipo === "entrada" ? "text-accent" : "text-red"}`}>
                      {t.tipo === "entrada" ? "+ " : "- "}
                      {formatarMoeda(t.valor)}
                    </Td>
                  </Tr>
                ))}
                {!transacoes?.length && (
                  <Tr>
                    <Td colSpan={4} className="text-text-faint text-center py-6">
                      Nenhum lançamento ainda para esse cliente.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
            <div className="text-text-faint text-[11.5px] mt-3">{transacoes?.length ?? 0} lançamentos</div>
          </>
        )}
      </Card>
    </Stage>
  )
}
