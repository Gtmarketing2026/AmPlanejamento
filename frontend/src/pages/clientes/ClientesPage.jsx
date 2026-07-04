import { Fragment, useState } from "react"
import { useNavigate } from "react-router-dom"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Field, { Select } from "../../components/ui/Field"
import Pill from "../../components/ui/Pill"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import { useAtualizarCliente, useClientes, useCriarCliente, useExcluirCliente } from "../../hooks/useClientes"
import { formatarData, formatarMoeda, iniciais, somarDias } from "../../lib/format"

const CLIENTES_INCLUSOS = 4
const FORM_VAZIO = {
  nome: "",
  tipo: "PF",
  documento: "",
  cnpj: "",
  nome_pj: "",
  valor_honorario_mensal: "",
  nickname: "",
  senha: "",
}

export default function ClientesPage() {
  const navigate = useNavigate()
  const { data: clientes, isLoading, error } = useClientes()
  const criar = useCriarCliente()
  const atualizar = useAtualizarCliente()
  const excluir = useExcluirCliente()
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [verId, setVerId] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [erro, setErro] = useState(null)

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  function onNovoCliente() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErro(null)
    setFormAberto((v) => (editandoId ? true : !v))
  }

  function onEditar(c) {
    setEditandoId(c.id)
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      documento: c.documento,
      cnpj: c.cnpj || "",
      nome_pj: c.nome_pj || "",
      valor_honorario_mensal: c.valor_honorario_mensal ?? "",
      nickname: c.nickname || "",
      senha: "",
    })
    setErro(null)
    setFormAberto(true)
  }

  function onCancelar() {
    setFormAberto(false)
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setErro(null)
  }

  async function onSubmit(e) {
    e.preventDefault()
    setErro(null)
    const dadosComuns = {
      nome: form.nome,
      tipo: form.tipo,
      documento: form.documento,
      cnpj: form.cnpj || null,
      nome_pj: form.nome_pj || null,
      valor_honorario_mensal: form.valor_honorario_mensal ? Number(form.valor_honorario_mensal) : null,
      nickname: form.nickname,
    }
    try {
      if (editandoId) {
        const dados = { ...dadosComuns }
        if (form.senha) dados.senha = form.senha // só troca se preenchida
        await atualizar.mutateAsync({ id: editandoId, dados })
      } else {
        await criar.mutateAsync({ ...dadosComuns, senha: form.senha })
      }
      onCancelar()
    } catch (err) {
      setErro(err.message)
    }
  }

  async function onExcluir(id) {
    if (!confirm("Excluir este cliente?")) return
    await excluir.mutateAsync({ id, dados: {} })
  }

  const total = clientes?.length ?? 0
  const vagasLivres = Math.max(0, CLIENTES_INCLUSOS - total)
  const salvando = criar.isPending || atualizar.isPending

  return (
    <Stage eyebrow="Etapa 02" title="Profissional cadastra um cliente" description="Cadastrar já cobra o ciclo atual integralmente — o prazo de 35 dias evita a cobrança do próximo ciclo, não reembolsa o primeiro. Clique num cliente pra entrar no dash dele.">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-display font-semibold text-lg">Meus clientes</div>
          <div className="text-text-dim text-[12.5px]">
            {total} de {CLIENTES_INCLUSOS} inclusos
          </div>
        </div>
        <Button onClick={onNovoCliente}>+ Novo cliente</Button>
      </div>

      <Card className="mb-4" style={{ borderColor: "rgba(240,166,60,0.3)", background: "rgba(240,166,60,0.08)" }}>
        <p className="text-amber text-[12.5px] leading-relaxed">
          ⚠️ Cadastrar um cliente já cobra o ciclo atual integralmente. O prazo abaixo só evita a
          cobrança do <strong>próximo</strong> ciclo.
        </p>
      </Card>

      {formAberto && (
        <Card className="mb-4">
          <div className="font-display font-semibold mb-3">
            {editandoId ? "Editar cliente" : "Novo cliente"}
          </div>
          <form onSubmit={onSubmit}>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Nome" value={form.nome} onChange={set("nome")} required />
              <Select label="Tipo principal" value={form.tipo} onChange={set("tipo")}>
                <option value="PF">PF</option>
                <option value="PJ">PJ</option>
              </Select>
              <Field label="CPF" value={form.documento} onChange={set("documento")} required />
              <Field
                label="Honorário mensal"
                type="number"
                step="0.01"
                value={form.valor_honorario_mensal}
                onChange={set("valor_honorario_mensal")}
              />
            </div>

            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mt-2 mb-2">
              Contexto PJ (opcional — mesma pessoa, também tem empresa)
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Field label="CNPJ" value={form.cnpj} onChange={set("cnpj")} placeholder="opcional" />
              <Field label="Nome da empresa" value={form.nome_pj} onChange={set("nome_pj")} placeholder="ex: Castro Design" />
            </div>

            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mt-2 mb-2">
              Acesso do cliente ao próprio dashboard
            </div>
            <div className="grid grid-cols-4 gap-3 items-end">
              <Field label="Nickname (login)" value={form.nickname} onChange={set("nickname")} required />
              <Field
                label="Senha"
                type="password"
                value={form.senha}
                onChange={set("senha")}
                placeholder={editandoId ? "deixe em branco p/ manter" : ""}
                required={!editandoId}
              />
              <div className="col-span-2 flex gap-2">
                <Button type="submit" disabled={salvando}>
                  {salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar cliente"}
                </Button>
                <Button type="button" variant="ghost" onClick={onCancelar}>
                  Cancelar
                </Button>
              </div>
            </div>
            {erro && <p className="text-red text-[12.5px] mt-3">{erro}</p>}
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
                <Fragment key={c.id}>
                  <Tr className="cursor-pointer hover:bg-panel" onClick={() => navigate(`/dashboard/${c.id}`)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-panel border border-line flex items-center justify-center text-[11px] font-mono">
                          {iniciais(c.nome)}
                        </div>
                        {c.nome}
                        {c.cnpj && <Pill variant="neutral">PJ: {c.nome_pj || "sem nome"}</Pill>}
                      </div>
                    </Td>
                    <Td>{c.tipo}</Td>
                    <Td className="font-mono text-text-dim">{formatarData(c.data_cadastro)}</Td>
                    <Td className="font-mono text-text-dim">{formatarData(somarDias(c.data_cadastro, 35))}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setVerId((v) => (v === c.id ? null : c.id))
                        }}
                        className="text-text-dim text-[12px] hover:underline mr-3"
                      >
                        Ver
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditar(c)
                        }}
                        className="text-blue text-[12px] hover:underline mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onExcluir(c.id)
                        }}
                        className="text-red text-[12px] hover:underline"
                      >
                        Excluir
                      </button>
                    </Td>
                  </Tr>
                  {verId === c.id && (
                    <Tr onClick={(e) => e.stopPropagation()} className="cursor-default bg-panel/40">
                      <Td colSpan={5}>
                        <div className="grid grid-cols-4 gap-4 text-[12.5px] py-1">
                          <div>
                            <div className="text-text-faint text-[11px] uppercase font-mono mb-1">CPF</div>
                            {c.documento}
                          </div>
                          <div>
                            <div className="text-text-faint text-[11px] uppercase font-mono mb-1">CNPJ / Empresa</div>
                            {c.cnpj ? `${c.cnpj} — ${c.nome_pj || "sem nome"}` : "—"}
                          </div>
                          <div>
                            <div className="text-text-faint text-[11px] uppercase font-mono mb-1">Nickname (login)</div>
                            {c.nickname || "—"}
                          </div>
                          <div>
                            <div className="text-text-faint text-[11px] uppercase font-mono mb-1">Honorário mensal</div>
                            {formatarMoeda(c.valor_honorario_mensal)}
                          </div>
                        </div>
                      </Td>
                    </Tr>
                  )}
                </Fragment>
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
