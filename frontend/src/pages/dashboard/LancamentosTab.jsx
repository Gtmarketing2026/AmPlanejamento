import Card from "../../components/ui/Card"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useTransacoesCliente } from "../../hooks/useImportacoes"
import { formatarData, formatarMoeda } from "../../lib/format"

export default function LancamentosTab({ clienteId }) {
  const { data: transacoes, isLoading, error } = useTransacoesCliente(clienteId)

  return (
    <Card>
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Lançamentos — importados via Financeiro → Importar extrato
      </div>
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
                    Nenhum lançamento ainda — importe um extrato em Financeiro → Importar extrato.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
          <div className="text-text-faint text-[11.5px] mt-3">
            {transacoes?.length ?? 0} lançamentos · categorização e tags ainda não implementadas
          </div>
        </>
      )}
    </Card>
  )
}
