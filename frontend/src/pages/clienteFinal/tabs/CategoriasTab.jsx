import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import {
  atualizarMinhaCategoria,
  atualizarMinhaSubcategoria,
  criarMinhaCategoria,
  criarMinhaSubcategoria,
  excluirMinhaCategoria,
  excluirMinhaSubcategoria,
  minhasCategorias,
  minhasSubcategorias,
} from "../../../api/clientes"

const TIPOS = {
  saida: "Despesas",
  entrada: "Receitas",
  investimento: "Investimentos",
  neutra: "Classificação neutra",
}
const CONTEXTO_LABEL = { PF: "Pessoal", PJ: "Empresa", ambos: "Pessoal e Empresa" }
const FORM_VAZIO = { nome: "", tipo: "saida", icone: "", contexto: "ambos" }

export default function CategoriasTab({ token, temCnpj = false }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(FORM_VAZIO)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [subEmAberto, setSubEmAberto] = useState(null) // categoria_id com o form de subcategoria aberto
  const [novaSub, setNovaSub] = useState("")
  const [editandoSubId, setEditandoSubId] = useState(null)
  const [nomeSubEdicao, setNomeSubEdicao] = useState("")
  const [erro, setErro] = useState(null)

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  const { data: subcategorias = [] } = useQuery({
    queryKey: ["cliente-eu-subcategorias", token],
    queryFn: () => minhasSubcategorias(token),
    enabled: !!token,
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["cliente-eu-categorias", token] })
    qc.invalidateQueries({ queryKey: ["cliente-eu-subcategorias", token] })
  }

  const salvarCategoria = useMutation({
    mutationFn: () => {
      const dados = { nome: form.nome, icone: form.icone || null, contexto: form.contexto }
      if (editandoId) return atualizarMinhaCategoria(token, editandoId, dados)
      return criarMinhaCategoria(token, { ...dados, tipo: form.tipo })
    },
    onSuccess: () => {
      invalidar()
      setForm(FORM_VAZIO)
      setMostrarForm(false)
      setEditandoId(null)
      setErro(null)
    },
    onError: (e) => setErro(e.message || "Não foi possível salvar."),
  })

  const excluirCategoria = useMutation({
    mutationFn: (id) => excluirMinhaCategoria(token, id),
    onSuccess: invalidar,
  })

  const salvarSub = useMutation({
    mutationFn: (categoriaId) => criarMinhaSubcategoria(token, { categoria_id: categoriaId, nome: novaSub }),
    onSuccess: () => {
      invalidar()
      setNovaSub("")
      setSubEmAberto(null)
    },
  })

  const editarSub = useMutation({
    mutationFn: ({ id, nome }) => atualizarMinhaSubcategoria(token, id, { nome }),
    onSuccess: () => {
      invalidar()
      setEditandoSubId(null)
    },
  })

  const excluirSub = useMutation({
    mutationFn: (id) => excluirMinhaSubcategoria(token, id),
    onSuccess: invalidar,
  })

  function editar(categoria) {
    setEditandoId(categoria.id)
    setForm({ nome: categoria.nome, tipo: categoria.tipo, icone: categoria.icone || "", contexto: categoria.contexto })
    setMostrarForm(true)
  }

  function novoForm() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
    setMostrarForm(true)
  }

  if (isLoading) return <p className="text-text-faint text-sm">Carregando…</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-text-dim text-[13px]">
          Categorias e subcategorias usadas pra classificar seus lançamentos. As com{" "}
          <span className="text-text-faint">cadeado</span> vêm do sistema ou foram criadas pelo seu planejador — só
          as suas próprias podem ser editadas ou excluídas.
        </p>
        <Button onClick={novoForm}>+ Nova categoria</Button>
      </div>

      {mostrarForm && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            {editandoId ? "Editar categoria" : "Nova categoria"}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (form.nome.trim()) salvarCategoria.mutate()
            }}
          >
            <div className="flex gap-3 flex-wrap items-start">
              <div className="flex-1 min-w-[180px]">
                <Field
                  label="Nome"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="ex: Streaming"
                />
              </div>
              <div className="w-28">
                <Field
                  label="Ícone (emoji)"
                  value={form.icone}
                  onChange={(e) => setForm((f) => ({ ...f, icone: e.target.value }))}
                  placeholder="🎬"
                />
              </div>
              {!editandoId && (
                <div className="w-44">
                  <Select label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                    <option value="saida">Despesa</option>
                    <option value="entrada">Receita</option>
                    <option value="investimento">Investimento</option>
                    <option value="neutra">Classificação neutra</option>
                  </Select>
                </div>
              )}
              {temCnpj && (
                <div className="w-48">
                  <Select
                    label="Contexto"
                    value={form.contexto}
                    onChange={(e) => setForm((f) => ({ ...f, contexto: e.target.value }))}
                  >
                    <option value="ambos">Pessoal e Empresa</option>
                    <option value="PF">Só Pessoal</option>
                    <option value="PJ">Só Empresa</option>
                  </Select>
                </div>
              )}
            </div>
            {erro && <p className="text-red text-[12.5px] mb-2">{erro}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!form.nome.trim() || salvarCategoria.isPending}>
                {salvarCategoria.isPending ? "Salvando…" : editandoId ? "Salvar alterações" : "Adicionar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMostrarForm(false)
                  setEditandoId(null)
                  setForm(FORM_VAZIO)
                  setErro(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {Object.entries(TIPOS).map(([tipo, label]) => {
        const doTipo = categorias.filter((c) => c.tipo === tipo)
        if (!doTipo.length) return null
        return (
          <Card key={tipo}>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">{label}</div>
            <div className="flex flex-col gap-3">
              {doTipo.map((c) => {
                const subsDaCategoria = subcategorias.filter((s) => s.categoria_id === c.id)
                return (
                  <div key={c.id} className="border border-line rounded-[9px] px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-[13.5px]">
                        <span>{c.icone || "🏷️"}</span>
                        {c.nome}
                        {!c.editavel && <span title="Não editável por você" className="text-text-faint text-[12px]">🔒</span>}
                        {temCnpj && (
                          <span className="text-text-faint text-[11px] font-normal">· {CONTEXTO_LABEL[c.contexto]}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSubEmAberto(subEmAberto === c.id ? null : c.id)}
                          className="text-text-faint hover:text-text text-[11.5px]"
                        >
                          + Subcategoria
                        </button>
                        {c.editavel && (
                          <>
                            <button onClick={() => editar(c)} className="text-text-faint hover:text-text text-[11.5px]">
                              ✎
                            </button>
                            <button
                              onClick={() =>
                                confirm(`Excluir "${c.nome}"? Lançamentos que usam essa categoria ficam sem categoria.`) &&
                                excluirCategoria.mutate(c.id)
                              }
                              className="text-text-faint hover:text-red text-[11.5px]"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!!subsDaCategoria.length && (
                      <div className="flex flex-wrap gap-2 mt-2.5 pl-6">
                        {subsDaCategoria.map((s) =>
                          editandoSubId === s.id ? (
                            <span key={s.id} className="flex items-center gap-1.5">
                              <input
                                autoFocus
                                value={nomeSubEdicao}
                                onChange={(e) => setNomeSubEdicao(e.target.value)}
                                className="bg-bg border border-line rounded-[7px] px-2 py-1 text-[11.5px] text-text outline-none focus:border-accent/60 w-32"
                              />
                              <button
                                onClick={() => editarSub.mutate({ id: s.id, nome: nomeSubEdicao })}
                                className="text-accent text-[11px] hover:underline"
                              >
                                OK
                              </button>
                            </span>
                          ) : (
                            <span
                              key={s.id}
                              className="flex items-center gap-1.5 bg-panel-2 rounded-full px-2.5 py-1 text-[11.5px] text-text-dim"
                            >
                              {s.nome}
                              {!s.editavel && <span className="text-text-faint">🔒</span>}
                              {s.editavel && (
                                <span className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditandoSubId(s.id)
                                      setNomeSubEdicao(s.nome)
                                    }}
                                    className="text-text-faint hover:text-text"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    onClick={() =>
                                      confirm(`Excluir "${s.nome}"?`) && excluirSub.mutate(s.id)
                                    }
                                    className="text-text-faint hover:text-red"
                                  >
                                    ✕
                                  </button>
                                </span>
                              )}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {subEmAberto === c.id && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (novaSub.trim()) salvarSub.mutate(c.id)
                        }}
                        className="flex items-center gap-2 mt-2.5 pl-6"
                      >
                        <input
                          autoFocus
                          value={novaSub}
                          onChange={(e) => setNovaSub(e.target.value)}
                          placeholder="Nome da subcategoria"
                          className="bg-bg border border-line rounded-[7px] px-2.5 py-1.5 text-[12px] text-text placeholder:text-text-faint outline-none focus:border-accent/60 w-44"
                        />
                        <button type="submit" className="text-accent text-[11.5px] hover:underline" disabled={salvarSub.isPending}>
                          Adicionar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubEmAberto(null)
                            setNovaSub("")
                          }}
                          className="text-text-faint text-[11.5px] hover:underline"
                        >
                          Cancelar
                        </button>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}

      {!categorias.length && (
        <Card>
          <p className="text-text-faint text-[12.5px] text-center py-6">Nenhuma categoria ainda.</p>
        </Card>
      )}
    </div>
  )
}
