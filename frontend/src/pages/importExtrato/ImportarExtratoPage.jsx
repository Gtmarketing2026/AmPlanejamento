import { useRef, useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field, { Select } from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import Tabs from "../../components/ui/Tabs"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useClientes } from "../../hooks/useClientes"
import { useCriarImportacao, useExcluirImportacao, useImportacoes } from "../../hooks/useImportacoes"
import { listarContasDoCliente } from "../../api/contas"
import { gerarParcelasImportacao } from "../../api/importacoes"
import { useQuery } from "@tanstack/react-query"
import { formatarData } from "../../lib/format"

const STATUS_VARIANT = { processado: "on", processando: "warn", erro: "off" }

export default function ImportarExtratoPage() {
  const { data: clientes } = useClientes()
  const [clienteId, setClienteId] = useState("")
  const clienteAtual = clientes?.find((c) => c.id === clienteId) || clientes?.[0]
  const clienteIdEfetivo = clienteAtual?.id

  const [tipoDoc, setTipoDoc] = useState("extrato")
  const [periodoInicio, setPeriodoInicio] = useState("")
  const [periodoFim, setPeriodoFim] = useState("")
  const [senhaPdf, setSenhaPdf] = useState("")
  const [contaId, setContaId] = useState("")
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [erro, setErro] = useState(null)
  const fileInputRef = useRef(null)
  const ehPdf = nomeArquivo.toLowerCase().endsWith(".pdf")

  const { data: historico, isLoading } = useImportacoes(clienteIdEfetivo)
  const criar = useCriarImportacao(clienteIdEfetivo)
  const excluir = useExcluirImportacao(clienteIdEfetivo)
  const { data: contas = [] } = useQuery({
    queryKey: ["contas-cliente", clienteIdEfetivo],
    queryFn: () => listarContasDoCliente(clienteIdEfetivo),
    enabled: !!clienteIdEfetivo,
  })
  const naturezaEsperada = tipoDoc === "fatura_cartao" ? "cartao" : "conta"
  const contasCompativeis = contas.filter((c) => c.natureza === naturezaEsperada)

  async function onProcessar(e) {
    e.preventDefault()
    setErro(null)
    const arquivo = fileInputRef.current?.files?.[0]
    if (!arquivo) {
      setErro("Selecione um arquivo.")
      return
    }
    try {
      const imp = await criar.mutateAsync({
        clienteId: clienteIdEfetivo,
        tipoDocumento: tipoDoc,
        periodoInicio: periodoInicio || null,
        periodoFim: periodoFim || null,
        senhaPdf: senhaPdf || null,
        contaConectadaId: contaId || null,
        arquivo,
      })
      if (imp?.parcelamentos_detectados > 0) {
        const ok = confirm(
          `Encontramos ${imp.parcelamentos_detectados} compra(s) parcelada(s). ` +
            `Deseja gerar as parcelas futuras nos próximos meses pra o cliente ter a visão completa dos gastos? ` +
            `(Aparecem como "previstas" e são substituídas automaticamente quando a fatura real chega.)`
        )
        if (ok) await gerarParcelasImportacao(imp.id)
      }
      fileInputRef.current.value = ""
      setNomeArquivo("")
      setSenhaPdf("")
      setContaId("")
    } catch (err) {
      setErro(err.message)
    }
  }

  async function onExcluir(id, arquivo) {
    if (!confirm(`Excluir a importação "${arquivo}"? Isso remove também todos os lançamentos dela.`)) return
    await excluir.mutateAsync(id)
  }

  return (
    <Stage
      eyebrow="Plano Essencial · também disponível no Completo"
      title="Importar extrato e fatura"
      description="Upload manual — o sistema lê o arquivo e organiza as transações, com a mesma lógica de dedup do Open Finance."
    >
      <Card className="mb-5">
        <Select
          label="Cliente"
          value={clienteIdEfetivo || ""}
          onChange={(e) => setClienteId(e.target.value)}
        >
          {clientes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Card>

      {!clienteIdEfetivo && (
        <Card>
          <p className="text-text-faint text-sm">Cadastre um cliente primeiro em Cadastros → Cliente.</p>
        </Card>
      )}

      {clienteIdEfetivo && (
        <div className="grid grid-cols-[1fr_1.1fr] gap-6">
          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Novo upload</div>
            <form onSubmit={onProcessar}>
              <div className="border-2 border-dashed border-line rounded-xl bg-panel-2 p-8 text-center mb-4">
                <div className="text-2xl mb-2">📄</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.csv,.pdf"
                  onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name || "")}
                  className="text-[12px] text-text-dim mx-auto"
                />
                <div className="text-text-faint text-[11.5px] mt-2">OFX, CSV ou PDF</div>
              </div>

              {ehPdf && (
                <div className="mb-4">
                  <Field
                    label="Senha do PDF (se houver)"
                    type="password"
                    value={senhaPdf}
                    onChange={(e) => setSenhaPdf(e.target.value)}
                    placeholder="opcional"
                  />
                  <p className="text-text-faint text-[11px] -mt-2">
                    Faturas de cartão às vezes vêm protegidas por senha (geralmente dígitos do CPF/nascimento do titular).
                  </p>
                </div>
              )}

              <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">Tipo de documento</div>
              <div className="mb-4">
                <Tabs
                  options={[
                    { value: "extrato", label: "Extrato de conta" },
                    { value: "fatura_cartao", label: "Fatura de cartão" },
                  ]}
                  active={tipoDoc}
                  onChange={(v) => {
                    setTipoDoc(v)
                    setContaId("")
                  }}
                />
              </div>

              {!!contasCompativeis.length && (
                <div className="mb-4">
                  <Select
                    label={naturezaEsperada === "cartao" ? "Cartão" : "Conta"}
                    value={contaId}
                    onChange={(e) => setContaId(e.target.value)}
                  >
                    <option value="">Sem conta específica</option>
                    {contasCompativeis.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_exibicao}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Período início" type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
                <Field label="Período fim" type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
              </div>
              {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
              <Button type="submit" block disabled={criar.isPending}>
                {criar.isPending ? "Processando…" : "Processar arquivo"}
              </Button>
            </form>
            <p className="text-text-faint text-[11px] font-mono mt-3">
              Formatos aceitos: .ofx (recomendado) · .csv (data;descricao;valor) · .pdf (melhor esforço, sem OCR)
            </p>
          </Card>

          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
              Histórico de importações
            </div>
            {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
            {!isLoading && (
              <Table>
                <Thead>
                  <Th>Arquivo</Th>
                  <Th>Formato</Th>
                  <Th>Transações</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </Thead>
                <tbody>
                  {historico?.map((h) => (
                    <Tr key={h.id}>
                      <Td className="font-mono text-text-dim">{formatarData(h.criado_em)}</Td>
                      <Td className="uppercase">{h.formato_arquivo}</Td>
                      <Td className="font-mono">
                        {h.status === "processado"
                          ? `${h.transacoes_importadas} novas${h.transacoes_duplicadas ? ` · ${h.transacoes_duplicadas} dup.` : ""}`
                          : h.erro_detalhe || "—"}
                      </Td>
                      <Td>
                        <Pill variant={STATUS_VARIANT[h.status]} pulse={h.status === "processando"}>
                          {h.status}
                        </Pill>
                      </Td>
                      <Td className="text-right">
                        <button
                          onClick={() => onExcluir(h.id, h.formato_arquivo)}
                          className="text-red text-[12px] hover:underline"
                        >
                          Excluir
                        </button>
                      </Td>
                    </Tr>
                  ))}
                  {!historico?.length && (
                    <Tr>
                      <Td colSpan={5} className="text-text-faint text-center py-6">
                        Nenhuma importação ainda.
                      </Td>
                    </Tr>
                  )}
                </tbody>
              </Table>
            )}
            <p className="text-text-faint text-[11px] mt-3 leading-relaxed">
              Transações duplicadas são identificadas automaticamente e não entram de novo na conciliação.
              Excluir uma importação remove também os lançamentos gerados por ela.
            </p>
          </Card>
        </div>
      )}
    </Stage>
  )
}
