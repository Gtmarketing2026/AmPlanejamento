import { useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Field, { Select } from "../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useClientes, useCriarCliente, useExcluirCliente } from "../../hooks/useClientes"
import { formatarData, iniciais, somarDias } from "../../lib/format"

const CLIENTES_INCLUSOS = 4

export default function ClientesPage() {
  const { data: clientes, isLoading, error } = useClientes()
  const criar = useCriarCliente()
  const excluir = useExcluirCliente()
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState({ nome: "", tipo: "PF", documento: "", valor_honorario_mensal: "" })

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    await criar.mutateAsync({
      nome: form.nome,
      tipo: form.tipo,
      documento: form.documento,
      valor_honorario_mensal: form.valor_honorario_mensal ? Number(form.valor_honorario_mensal) : null,
    })
    setForm({ nome: "", tipo: "PF", documento: "", valor_honorario_mensal: "" })
    setFormAberto(false)
  }

  async function onExcluir(id) {
    if (!confirm("Excluir este cliente?")) return
    await excluir.mutateAsync({ id, dados: {} })
  }

  const total = clientes?.length ?? 0
  const vagasLivres = Math.max(0, CLIENTES_INCLUSOS - total)

  return (
    <Stage eyebrow="Etapa 02" title="Profissional cadastra um cliente" description="Cadastrar já cobra o ciclo atual integralmente — o prazo de 35 dias evita a cobrança do próximo ciclo, não reembolsa o primeiro.">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-semibold text-lg">Meus clientes</div>
          <div className="text-text-dim text-[12.5px]">
            {total} de {CLIENTES_INCLUSOS} inclusos
          </div>
        </div>
        <Button onClick={() => setFormAberto((v) => !v)}>+ Novo cliente</Button>
      </div>

      <Card className="mb-4" style={{ borderColor: "rgba(240,166,60,0.3)", background: "rgba(240,166,60,0.08)" }}>
        <p className="text-amber text-[12.5px] leading-relaxed">
          ⚠️ Cadastrar um cliente já cobra o ciclo atual integralmente. O prazo abaixo só evita a
          cobrança do <strong>próximo</strong> ciclo.
        </p>
      </Card>

      {formAberto && (
        <Card className="mb-4">
          <form onSubmit={onSubmit} className="grid grid-cols-4 gap-3 items-end">
            <Field label="Nome" value={form.nome} onChange={set("nome")} required />
            <Select label="Tipo" value={form.tipo} onChange={set("tipo")}>
              <option value="PF">PF</option>
              <option value="PJ">PJ</option>
            </Select>
            <Field label="CPF/CNPJ" value={form.documento} onChange={set("documento")} required />
            <Field
              label="Honorário mensal"
              type="number"
              step="0.01"
              value={form.valor_honorario_mensal}
              onChange={set("valor_honorario_mensal")}
            />
            <div className="col-span-4">
              <Button type="submit" disabled={criar.isPending}>
                {criar.isPending ? "Salvando…" : "Salvar cliente"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {error && <p className="text-red text-sm">Não foi possível carregar os clientes.</p>}
        {!isLoading && !error && (
          <Table>
            <Thead>
              <Th>Cliente</Th>
              <Th>Tipo</Th>
              <Th>Cadastrado em</Th>
              <Th>Prazo p/ evitar cobrança do próximo ciclo</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {clientes?.map((c) => (
                <Tr key={c.id}>
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
                  <Td className="font-mono text-text-dim">{formatarData(somarDias(c.data_cadastro, 35))}</Td>
                  <Td className="text-right">
                    <button
                      onClick={() => onExcluir(c.id)}
                      className="text-red text-[12px] hover:underline"
                    >
                      Excluir
                    </button>
                  </Td>
                </Tr>
              ))}
              {Array.from({ length: vagasLivres }).map((_, i) => (
                <Tr key={`vaga-${i}`} className="opacity-40">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full border border-dashed border-line" />
                      Vaga disponível
                    </div>
                  </Td>
                  <Td colSpan={3} className="text-text-faint">
                    {CLIENTES_INCLUSOS}ª vaga incluída no plano base — livre
                  </Td>
                  <Td></Td>
                </Tr>
              ))}
              {total === 0 && vagasLivres === 0 && (
                <Tr>
                  <Td colSpan={5} className="text-text-faint text-center py-6">
                    Nenhum cliente cadastrado ainda.
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
