import { useState } from "react"
import Card from "../../components/ui/Card"
import EditorCategoria from "../../components/ui/EditorCategoria"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useCategorias, useSubcategorias } from "../../hooks/useCategorias"
import { useAtualizarTransacao, useExcluirTransacao, useTransacoesCliente } from "../../hooks/useImportacoes"
import { formatarData, formatarMoeda } from "../../lib/format"

export default function LancamentosTab({ clienteId }) {
  const { data: transacoes, isLoading, error } = useTransacoesCliente(clienteId)
  const { data: categorias } = useCategorias()
  const { data: subcategorias } = useSubcategorias()
  const atualizarTransacao = useAtualizarTransacao(clienteId)
  const excluirTransacao = useExcluirTransacao(clienteId)
  const [mensagemReclassificacao, setMensagemReclassificacao] = useState(null)

  function onAtualizar(id, dados) {
    atualizarTransacao.mutate(
      { id, dados },
      {
        onSuccess: (resposta) => {
          if (resposta?.quantidade_atualizada) {
            setMensagemReclassificacao(
              `Categoria aplicada a mais ${resposta.quantidade_atualizada} lançamento(s) igual(is).`
            )
            setTimeout(() => setMensagemReclassificacao(null), 3500)
          }
        },
      }
    )
  }

  return (
    <Card>
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Lançamentos — importados pelo cliente · categoria sugerida automaticamente por IA, editável
        abaixo
      </div>
      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {error && <p className="text-red text-sm">Não foi possível carregar os lançamentos.</p>}
      {!isLoading && !error && (
        <>
          {mensagemReclassificacao && (
            <div className="bg-accent/10 text-accent text-[12.5px] rounded-[9px] px-3.5 py-2 mb-3">
              {mensagemReclassificacao}
            </div>
          )}
          <Table>
            <Thead>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Origem</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Valor</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {transacoes?.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-mono text-text-dim">{formatarData(t.data)}</Td>
                  <Td>{t.descricao}</Td>
                  <Td className="text-text-dim">{t.origem === "cartao" ? "Cartão" : "Conta"}</Td>
                  <Td>
                    <EditorCategoria
                      categoriaId={t.categoria_id}
                      subcategoriaId={t.subcategoria_id}
                      categorias={categorias}
                      subcategorias={subcategorias}
                      disabled={atualizarTransacao.isPending}
                      onChange={(dados) => onAtualizar(t.id, dados)}
                    />
                  </Td>
                  <Td className={`text-right font-mono ${t.tipo === "entrada" ? "text-accent" : "text-red"}`}>
                    {t.tipo === "entrada" ? "+ " : "- "}
                    {formatarMoeda(t.valor)}
                  </Td>
                  <Td className="text-right">
                    <button
                      onClick={() => confirm("Excluir este lançamento?") && excluirTransacao.mutate(t.id)}
                      className="text-text-faint hover:text-red text-[12px]"
                    >
                      Excluir
                    </button>
                  </Td>
                </Tr>
              ))}
              {!transacoes?.length && (
                <Tr>
                  <Td colSpan={6} className="text-text-faint text-center py-6">
                    Nenhum lançamento ainda — o cliente importa o próprio extrato em Importar extrato.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
          <div className="text-text-faint text-[11.5px] mt-3">{transacoes?.length ?? 0} lançamentos</div>
        </>
      )}
    </Card>
  )
}
