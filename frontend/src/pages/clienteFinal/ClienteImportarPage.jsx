import { useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import { Select } from "../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import {
  excluirMinhaImportacao,
  importarMeuExtrato,
  listarMinhasImportacoes,
} from "../../api/clientes"
import { formatarData } from "../../lib/format"

const STATUS_VARIANT = { processado: "on", processando: "warn", pendente: "warn", erro: "off" }

export default function ClienteImportarPage() {
  const { token } = useOutletContext()
  const qc = useQueryClient()
  const inputRef = useRef(null)
  const [tipoDocumento, setTipoDocumento] = useState("extrato")
  const [arquivo, setArquivo] = useState(null)
  const [erro, setErro] = useState(null)

  const { data: importacoes = [] } = useQuery({
    queryKey: ["cliente-eu-importacoes", token],
    queryFn: () => listarMinhasImportacoes(token),
    enabled: !!token,
  })

  const importar = useMutation({
    mutationFn: () => importarMeuExtrato(token, { tipoDocumento, arquivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      setArquivo(null)
      if (inputRef.current) inputRef.current.value = ""
    },
    onError: (e) => setErro(e.message),
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaImportacao(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
    },
  })

  function onEnviar(e) {
    e.preventDefault()
    setErro(null)
    if (!arquivo) return
    importar.mutate()
  }

  return (
    <div className="max-w-[820px] mx-auto px-8 py-10">
      <h1 className="font-display text-xl font-semibold mb-1">Importar extrato / fatura</h1>
      <p className="text-text-dim text-sm mb-5">
        Envie seu extrato bancário ou fatura de cartão (OFX, CSV ou PDF). Os lançamentos entram no seu
        painel já com a categoria sugerida automaticamente — você pode ajustar depois.
      </p>

      <Card className="mb-5">
        <form onSubmit={onEnviar} className="flex items-end gap-3 flex-wrap">
          <Select label="Tipo" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
            <option value="extrato">Extrato de conta</option>
            <option value="fatura_cartao">Fatura de cartão</option>
          </Select>
          <div className="mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">Arquivo</div>
            <input
              ref={inputRef}
              type="file"
              accept=".ofx,.csv,.pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              className="text-[12.5px] text-text-dim file:mr-3 file:py-2 file:px-3 file:rounded-[7px] file:border file:border-line file:bg-panel-2 file:text-text-dim"
            />
          </div>
          <Button type="submit" className="mb-3" disabled={!arquivo || importar.isPending}>
            {importar.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </form>
        {erro && <p className="text-red text-[12.5px] mt-1">{erro}</p>}
      </Card>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Importações
        </div>
        <Table>
          <Thead>
            <Th>Enviado em</Th>
            <Th>Tipo</Th>
            <Th>Formato</Th>
            <Th>Lançamentos</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <tbody>
            {importacoes.map((imp) => (
              <Tr key={imp.id}>
                <Td className="font-mono text-text-dim">{formatarData(imp.criado_em)}</Td>
                <Td>{imp.tipo_documento === "fatura_cartao" ? "Fatura" : "Extrato"}</Td>
                <Td className="uppercase text-text-dim">{imp.formato_arquivo}</Td>
                <Td className="font-mono">
                  {imp.transacoes_importadas}
                  {imp.transacoes_duplicadas > 0 && (
                    <span className="text-text-faint"> (+{imp.transacoes_duplicadas} dup.)</span>
                  )}
                </Td>
                <Td>
                  <Pill variant={STATUS_VARIANT[imp.status] || "neutral"}>{imp.status}</Pill>
                </Td>
                <Td className="text-right">
                  <button
                    onClick={() => confirm("Excluir esta importação e seus lançamentos?") && excluir.mutate(imp.id)}
                    className="text-red text-[12px] hover:underline"
                  >
                    Excluir
                  </button>
                </Td>
              </Tr>
            ))}
            {!importacoes.length && (
              <Tr>
                <Td colSpan={6} className="text-text-faint text-center py-6">
                  Nenhuma importação ainda.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}
