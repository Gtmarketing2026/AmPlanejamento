import { useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import Tabs from "../../components/ui/Tabs"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { importExtratoMockInicial } from "../../mocks/importExtrato.mock"

const STATUS_VARIANT = { processado: "on", processando: "warn", erro: "off" }

export default function ImportarExtratoPage() {
  const [tipoDoc, setTipoDoc] = useState("extrato")
  const [historico, setHistorico] = useState(importExtratoMockInicial)
  const [processando, setProcessando] = useState(false)

  function onProcessar(e) {
    e.preventDefault()
    setProcessando(true)
    // MOCK: nao existe endpoint de upload/parse ainda -- simula o ciclo
    // pendente -> processado, so pra ilustrar o fluxo esperado.
    const novaLinha = {
      arquivo: tipoDoc === "extrato" ? "novo_extrato.ofx" : "nova_fatura.pdf",
      periodo: "jul/2026",
      transacoes: "processando…",
      status: "processando",
    }
    setHistorico((h) => [novaLinha, ...h])
    setTimeout(() => {
      setHistorico((h) =>
        h.map((item, i) => (i === 0 ? { ...item, transacoes: "51 novas", status: "processado" } : item))
      )
      setProcessando(false)
    }, 1500)
  }

  return (
    <Stage
      eyebrow="Plano Essencial · também disponível no Completo"
      title="Importar extrato e fatura"
      description="Upload manual — o sistema lê o arquivo e organiza as transações, com a mesma lógica de dedup do Open Finance. Processamento abaixo é ilustrativo, sem parser real ainda."
    >
      <div className="grid grid-cols-[1fr_1.1fr] gap-6">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Novo upload</div>
          <div className="border-2 border-dashed border-line rounded-xl bg-panel-2 p-8 text-center mb-4">
            <div className="text-2xl mb-2">📄</div>
            <div className="font-medium text-[13px] mb-1">Arraste o arquivo aqui</div>
            <div className="text-text-faint text-[11.5px]">ou clique para selecionar — OFX, CSV ou PDF</div>
          </div>

          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">Tipo de documento</div>
          <div className="mb-4">
            <Tabs
              options={[
                { value: "extrato", label: "Extrato de conta" },
                { value: "fatura", label: "Fatura de cartão" },
              ]}
              active={tipoDoc}
              onChange={setTipoDoc}
            />
          </div>

          <form onSubmit={onProcessar}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Período início" type="date" defaultValue="2026-06-01" />
              <Field label="Período fim" type="date" defaultValue="2026-06-30" />
            </div>
            <Button type="submit" block disabled={processando}>
              {processando ? "Processando…" : "Processar arquivo"}
            </Button>
          </form>
          <p className="text-text-faint text-[11px] font-mono mt-3">
            Formatos aceitos: .ofx (recomendado) · .csv (mapeamento) · .pdf (extração de texto, mais lento)
          </p>
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Histórico de importações
          </div>
          <Table>
            <Thead>
              <Th>Arquivo</Th>
              <Th>Período</Th>
              <Th>Transações</Th>
              <Th>Status</Th>
            </Thead>
            <tbody>
              {historico.map((h, i) => (
                <Tr key={i}>
                  <Td>{h.arquivo}</Td>
                  <Td className="font-mono text-text-dim">{h.periodo}</Td>
                  <Td className="font-mono">{h.transacoes}</Td>
                  <Td>
                    <Pill variant={STATUS_VARIANT[h.status]} pulse={h.status === "processando"}>
                      {h.status}
                    </Pill>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="text-text-faint text-[11px] mt-3 leading-relaxed">
            Transações duplicadas (já importadas antes) são identificadas automaticamente e não entram de
            novo na conciliação.
          </p>
        </Card>
      </div>
    </Stage>
  )
}
