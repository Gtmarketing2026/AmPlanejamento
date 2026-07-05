import { useEffect, useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Field, { Select } from "../../components/ui/Field"
import { useAtualizarCliente, useClientes } from "../../hooks/useClientes"
import { formatarData, iniciais } from "../../lib/format"

export default function CrmPage() {
  const { data: clientes, isLoading } = useClientes()
  const atualizar = useAtualizarCliente()

  const [clienteId, setClienteId] = useState("")
  const [form, setForm] = useState({ perfil_comportamental: "", objetivo_principal: "" })
  const [salvo, setSalvo] = useState(false)

  const cliente = clientes?.find((c) => c.id === clienteId)

  // Seleciona o primeiro cliente por padrão e sincroniza o form quando troca.
  useEffect(() => {
    if (!clienteId && clientes?.length) setClienteId(clientes[0].id)
  }, [clientes, clienteId])
  useEffect(() => {
    if (cliente) {
      setForm({
        perfil_comportamental: cliente.perfil_comportamental || "",
        objetivo_principal: cliente.objetivo_principal || "",
      })
      setSalvo(false)
    }
  }, [cliente])

  async function onSalvar(e) {
    e.preventDefault()
    await atualizar.mutateAsync({
      id: clienteId,
      dados: {
        perfil_comportamental: form.perfil_comportamental || null,
        objetivo_principal: form.objetivo_principal || null,
      },
    })
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2500)
  }

  return (
    <Stage
      eyebrow="Relacionamento"
      title="CRM do profissional"
      description="Selecione um cliente e mantenha o perfil comportamental e o objetivo principal dele atualizados."
    >
      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading && !clientes?.length && (
        <Card>
          <p className="text-text-dim text-sm">
            Cadastre um cliente em <strong>Clientes</strong> pra começar a usar o CRM.
          </p>
        </Card>
      )}

      {!isLoading && clientes?.length > 0 && (
        <div className="max-w-xl">
          <div className="mb-4">
            <Select label="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>

          {cliente && (
            <Card>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-full bg-panel border border-line flex items-center justify-center text-[12px] font-mono">
                  {iniciais(cliente.nome)}
                </div>
                <div>
                  <div className="font-medium">{cliente.nome}</div>
                  <div className="text-text-faint text-[11.5px] font-mono">
                    Cliente desde {formatarData(cliente.data_cadastro)}
                  </div>
                </div>
              </div>

              <form onSubmit={onSalvar}>
                <Field
                  label="Perfil comportamental"
                  value={form.perfil_comportamental}
                  onChange={(e) => setForm((f) => ({ ...f, perfil_comportamental: e.target.value }))}
                  placeholder="ex: Cauteloso, Arrojado, Disciplinado"
                />
                <Field
                  label="Objetivo principal"
                  value={form.objetivo_principal}
                  onChange={(e) => setForm((f) => ({ ...f, objetivo_principal: e.target.value }))}
                  placeholder="ex: Aposentadoria aos 55, sair do aluguel"
                />
                <div className="flex items-center gap-3 mt-2">
                  <Button type="submit" disabled={atualizar.isPending}>
                    {atualizar.isPending ? "Salvando…" : "Salvar"}
                  </Button>
                  {salvo && <span className="text-accent text-[12.5px]">Perfil atualizado.</span>}
                </div>
              </form>

              <p className="text-text-faint text-[11.5px] mt-5 leading-relaxed">
                Timeline de interações e follow-ups (Google Agenda) entram numa próxima etapa — as tabelas
                interacoes_crm/follow_ups já existem no schema, falta a rota.
              </p>
            </Card>
          )}
        </div>
      )}
    </Stage>
  )
}
