import { Fragment, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useNegocio } from "../../context/NegocioContext"
import { useEntrarComo } from "../../hooks/useEntrarComo"
import {
  atualizarCredenciaisCliente,
  atualizarStatusCliente,
  listarClientesDoPlanejador,
  listarPlanejadores,
} from "../../api/negocio"
import { formatarData, formatarMoeda, iniciais } from "../../lib/format"

export default function CarteiraPlanejadorPage() {
  const { planejadorId } = useParams()
  const { planejador, sincronizarPlanejador } = useNegocio()
  const { entrarPlanejador, entrarCliente, carregando } = useEntrarComo()
  const qc = useQueryClient()

  const { data: planejadores } = useQuery({ queryKey: ["negocio-planejadores"], queryFn: listarPlanejadores })
  const { data: clientes, isLoading, error } = useQuery({
    queryKey: ["negocio-clientes", planejadorId],
    queryFn: () => listarClientesDoPlanejador(planejadorId),
    enabled: !!planejadorId,
  })

  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ nickname: "", senha: "" })

  const atualizarCredenciais = useMutation({
    mutationFn: ({ id, dados }) => atualizarCredenciaisCliente(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-clientes", planejadorId] })
      setEditandoId(null)
    },
  })

  const atualizarStatus = useMutation({
    mutationFn: ({ id, status: novoStatus }) => atualizarStatusCliente(id, { status: novoStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["negocio-clientes", planejadorId] }),
  })

  // Deep-link/refresh: se o contexto não bate com a URL, backfill do nome a
  // partir da lista de planejadores já carregada.
  const p = planejadores?.find((x) => x.id === planejadorId)
  useEffect(() => {
    if (p && planejador?.id !== p.id) sincronizarPlanejador({ id: p.id, nome: p.nome })
  }, [p, planejador, sincronizarPlanejador])

  const nome = planejador?.nome || p?.nome || "Planejador"

  function onEditar(e, c) {
    e.stopPropagation()
    setEditandoId((atual) => (atual === c.id ? null : c.id))
    setForm({ nickname: c.nickname || "", senha: "" })
    atualizarCredenciais.reset()
  }

  function onSalvar(e, id) {
    e.preventDefault()
    e.stopPropagation()
    const dados = {}
    if (form.nickname) dados.nickname = form.nickname
    if (form.senha) dados.senha = form.senha
    if (Object.keys(dados).length === 0) return
    atualizarCredenciais.mutate({ id, dados })
  }

  return (
    <Stage
      eyebrow="Nível Negócio → Planejador"
      title={`Carteira de ${nome}`}
      description="Clientes desse planejador, vistos pelo admin — status ativo/excluído, editar login e 'Entrar como cliente' (abre o painel de verdade dele)."
    >
      <div className="flex justify-end mb-4">
        <Button onClick={() => entrarPlanejador(planejadorId)} disabled={carregando}>
          Entrar como {nome} →
        </Button>
      </div>
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
                <Fragment key={c.id}>
                  <Tr className="cursor-pointer hover:bg-panel" onClick={() => entrarCliente(c.id)}>
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
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {["ativo", "excluido"].map((s) => (
                          <button
                            key={s}
                            disabled={c.status === s || atualizarStatus.isPending}
                            onClick={() => atualizarStatus.mutate({ id: c.id, status: s })}
                            className={`px-2 py-1 rounded text-[10.5px] font-mono border ${
                              c.status === s
                                ? "border-line text-text-faint opacity-40 cursor-default"
                                : "border-line text-text-dim hover:text-text hover:border-text-faint"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <button onClick={(e) => onEditar(e, c)} className="text-blue text-[12px] hover:underline mr-3">
                        Editar login
                      </button>
                      <span className="text-accent text-[12px]">Entrar como cliente →</span>
                    </Td>
                  </Tr>
                  {editandoId === c.id && (
                    <Tr onClick={(e) => e.stopPropagation()} className="cursor-default bg-panel/40">
                      <Td colSpan={6}>
                        <form onSubmit={(e) => onSalvar(e, c.id)} className="flex items-end gap-3 py-1">
                          <div className="w-56">
                            <Field
                              label="Nickname (login)"
                              value={form.nickname}
                              onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
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
                          <Button type="submit" disabled={atualizarCredenciais.isPending} className="mb-3">
                            {atualizarCredenciais.isPending ? "Salvando…" : "Salvar"}
                          </Button>
                          <Button type="button" variant="ghost" className="mb-3" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                          {atualizarCredenciais.isError && (
                            <p className="text-red text-[12.5px] mb-3">{atualizarCredenciais.error.message}</p>
                          )}
                        </form>
                      </Td>
                    </Tr>
                  )}
                </Fragment>
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
