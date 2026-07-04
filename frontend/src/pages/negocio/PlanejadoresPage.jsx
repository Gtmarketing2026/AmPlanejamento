import { Fragment, useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useEntrarComo } from "../../hooks/useEntrarComo"
import { atualizarCredenciaisPlanejador, listarPlanejadores } from "../../api/negocio"
import { formatarMoeda } from "../../lib/format"

const STATUS_VARIANT = { ativa: "on", congelada: "warn", cancelada: "off" }

export default function PlanejadoresPage() {
  const { entrarPlanejador, carregando } = useEntrarComo()
  const qc = useQueryClient()
  const { data: planejadores, isLoading, error } = useQuery({
    queryKey: ["negocio-planejadores"],
    queryFn: listarPlanejadores,
  })

  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ email: "", senha: "" })

  const atualizar = useMutation({
    mutationFn: ({ id, dados }) => atualizarCredenciaisPlanejador(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-planejadores"] })
      setEditandoId(null)
    },
  })

  function onEditar(p) {
    setEditandoId((atual) => (atual === p.id ? null : p.id))
    setForm({ email: p.email, senha: "" })
    atualizar.reset()
  }

  function onSalvar(e, id) {
    e.preventDefault()
    const dados = {}
    if (form.email) dados.email = form.email
    if (form.senha) dados.senha = form.senha
    if (Object.keys(dados).length === 0) return
    atualizar.mutate({ id, dados })
  }

  return (
    <Stage
      eyebrow="Nível Negócio · Admin"
      title="Planejadores"
      description="Todos os profissionais da plataforma. 'Entrar como' abre o app de verdade do planejador (sem precisar da senha dele), e 'Editar login' reseta e-mail/senha."
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
                <Fragment key={p.id}>
                  <Tr>
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
                    <Td className="text-right whitespace-nowrap">
                      <button
                        onClick={() => onEditar(p)}
                        className="text-blue text-[12px] hover:underline mr-3"
                      >
                        Editar login
                      </button>
                      <Link to={`/negocio/planejadores/${p.id}`} className="text-text-dim text-[12px] hover:underline mr-3">
                        Ver clientes
                      </Link>
                      <button
                        onClick={() => entrarPlanejador(p.id)}
                        disabled={p.status === "cancelada" || carregando}
                        className="text-accent text-[12px] hover:underline disabled:text-text-faint disabled:no-underline disabled:cursor-not-allowed"
                      >
                        Entrar como →
                      </button>
                    </Td>
                  </Tr>
                  {editandoId === p.id && (
                    <Tr className="bg-panel/40">
                      <Td colSpan={6}>
                        <form onSubmit={(e) => onSalvar(e, p.id)} className="flex items-end gap-3 py-1">
                          <div className="w-64">
                            <Field
                              label="E-mail de login"
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                            />
                          </div>
                          <div className="w-52">
                            <Field
                              label="Nova senha"
                              type="password"
                              value={form.senha}
                              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                              placeholder="deixe em branco pra manter"
                            />
                          </div>
                          <Button type="submit" disabled={atualizar.isPending} className="mb-3">
                            {atualizar.isPending ? "Salvando…" : "Salvar"}
                          </Button>
                          <Button type="button" variant="ghost" className="mb-3" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                          {atualizar.isError && (
                            <p className="text-red text-[12.5px] mb-3">{atualizar.error.message}</p>
                          )}
                        </form>
                      </Td>
                    </Tr>
                  )}
                </Fragment>
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
