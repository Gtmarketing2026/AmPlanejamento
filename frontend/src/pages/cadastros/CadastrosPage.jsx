import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field, { Select } from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import Tabs from "../../components/ui/Tabs"
import { cadastrosMockInicial } from "../../mocks/cadastros.mock"
import { useCategorias, useSubcategorias } from "../../hooks/useCategorias"
import {
  atualizarCategoria,
  atualizarSubcategoria,
  criarCategoria,
  criarSubcategoria,
  excluirCategoria,
  excluirSubcategoria,
} from "../../api/categorias"

const TIPOS = { saida: "Despesas", entrada: "Receitas", neutra: "Classificação neutra" }

function PillList({ items }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <Pill key={it.nome} variant={it.origem === "padrao" ? "on" : "warn"}>
          {it.nome} <span className="opacity-60">{it.origem === "padrao" ? "padrão" : "criado por você"}</span>
        </Pill>
      ))}
      {items.length === 0 && <span className="text-text-faint text-sm">Nenhum item ainda.</span>}
    </div>
  )
}

function AbaCategorias() {
  const qc = useQueryClient()
  const { data: categorias = [], isLoading } = useCategorias()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ nome: "", tipo: "saida", icone: "" })
  const [erro, setErro] = useState(null)

  const salvar = useMutation({
    mutationFn: () => {
      const dados = { nome: form.nome, icone: form.icone || null }
      if (editandoId) return atualizarCategoria(editandoId, dados)
      return criarCategoria({ ...dados, tipo: form.tipo })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias"] })
      setForm({ nome: "", tipo: "saida", icone: "" })
      setMostrarForm(false)
      setEditandoId(null)
      setErro(null)
    },
    onError: (e) => setErro(e.message || "Não foi possível salvar."),
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirCategoria(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categorias"] }),
  })

  function editar(c) {
    setEditandoId(c.id)
    setForm({ nome: c.nome, tipo: c.tipo, icone: c.icone || "" })
    setMostrarForm(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditandoId(null)
            setForm({ nome: "", tipo: "saida", icone: "" })
            setMostrarForm(true)
          }}
        >
          + Nova categoria
        </Button>
      </div>

      {mostrarForm && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (form.nome.trim()) salvar.mutate()
            }}
            className="flex gap-3 items-end flex-wrap"
          >
            <div className="flex-1 min-w-[180px]">
              <Field
                label="Nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="ex: Assinaturas"
              />
            </div>
            <div className="w-28">
              <Field
                label="Ícone (emoji)"
                value={form.icone}
                onChange={(e) => setForm((f) => ({ ...f, icone: e.target.value }))}
                placeholder="📺"
              />
            </div>
            {!editandoId && (
              <Select label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className="w-44">
                <option value="saida">Despesa</option>
                <option value="entrada">Receita</option>
                <option value="neutra">Classificação neutra</option>
              </Select>
            )}
            <Button type="submit" disabled={!form.nome.trim() || salvar.isPending}>
              {editandoId ? "Salvar" : "Adicionar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMostrarForm(false)}>
              Cancelar
            </Button>
          </form>
          {erro && <p className="text-red text-[12.5px] mt-2">{erro}</p>}
        </Card>
      )}

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading &&
        Object.entries(TIPOS).map(([tipo, label]) => {
          const doTipo = categorias.filter((c) => c.tipo === tipo)
          if (!doTipo.length) return null
          return (
            <Card key={tipo}>
              <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">{label}</div>
              <div className="flex flex-col gap-2">
                {doTipo.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border border-line rounded-[9px] px-3.5 py-2.5">
                    <span className="flex items-center gap-2 text-[13px]">
                      <span>{c.icone || "🏷️"}</span>
                      {c.nome}
                      {c.padrao_sistema && <span className="text-text-faint text-[11px]">padrão do sistema</span>}
                    </span>
                    {c.editavel && (
                      <div className="flex items-center gap-3">
                        <button onClick={() => editar(c)} className="text-text-faint hover:text-text text-[11.5px]">
                          ✎
                        </button>
                        <button
                          onClick={() =>
                            confirm(`Excluir "${c.nome}"? Lançamentos que usam essa categoria ficam sem categoria.`) &&
                            excluir.mutate(c.id)
                          }
                          className="text-text-faint hover:text-red text-[11.5px]"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
    </div>
  )
}

function AbaSubcategorias() {
  const qc = useQueryClient()
  const { data: categorias = [] } = useCategorias()
  const { data: subcategorias = [], isLoading } = useSubcategorias()
  const [categoriaMae, setCategoriaMae] = useState("")
  const [novoNome, setNovoNome] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [nomeEdicao, setNomeEdicao] = useState("")

  const criar = useMutation({
    mutationFn: () => criarSubcategoria({ categoria_id: categoriaMae, nome: novoNome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subcategorias"] })
      setNovoNome("")
    },
  })
  const editar = useMutation({
    mutationFn: ({ id, nome }) => atualizarSubcategoria(id, { nome }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subcategorias"] })
      setEditandoId(null)
    },
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirSubcategoria(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subcategorias"] }),
  })

  const categoriaAtual = categoriaMae || categorias[0]?.id || ""

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (novoNome.trim() && categoriaAtual) criar.mutate()
          }}
          className="flex gap-3 items-end flex-wrap"
        >
          <Select label="Categoria mãe" value={categoriaAtual} onChange={(e) => setCategoriaMae(e.target.value)} className="w-56">
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <div className="flex-1 min-w-[180px]">
            <Field label="Nova subcategoria" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="ex: Netflix" />
          </div>
          <Button type="submit" disabled={!novoNome.trim() || criar.isPending}>
            Adicionar
          </Button>
        </form>
      </Card>

      {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
      {!isLoading &&
        categorias
          .filter((c) => subcategorias.some((s) => s.categoria_id === c.id))
          .map((c) => (
            <Card key={c.id}>
              <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">{c.nome}</div>
              <div className="flex flex-wrap gap-2">
                {subcategorias
                  .filter((s) => s.categoria_id === c.id)
                  .map((s) =>
                    editandoId === s.id ? (
                      <span key={s.id} className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={nomeEdicao}
                          onChange={(e) => setNomeEdicao(e.target.value)}
                          className="bg-bg border border-line rounded-[7px] px-2 py-1 text-[11.5px] text-text outline-none focus:border-accent/60 w-32"
                        />
                        <button onClick={() => editar.mutate({ id: s.id, nome: nomeEdicao })} className="text-accent text-[11px] hover:underline">
                          OK
                        </button>
                      </span>
                    ) : (
                      <span key={s.id} className="flex items-center gap-1.5 bg-panel-2 rounded-full px-2.5 py-1 text-[11.5px] text-text-dim">
                        {s.nome}
                        {s.editavel ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditandoId(s.id)
                                setNomeEdicao(s.nome)
                              }}
                              className="text-text-faint hover:text-text"
                            >
                              ✎
                            </button>
                            <button onClick={() => confirm(`Excluir "${s.nome}"?`) && excluir.mutate(s.id)} className="text-text-faint hover:text-red">
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span className="text-text-faint">🔒</span>
                        )}
                      </span>
                    )
                  )}
              </div>
            </Card>
          ))}
    </div>
  )
}

export default function CadastrosPage() {
  const [subtab, setSubtab] = useState("bancos")
  const [dados, setDados] = useState(cadastrosMockInicial)
  const [novoNome, setNovoNome] = useState("")

  function adicionar(e) {
    e.preventDefault()
    if (!novoNome.trim()) return
    const item = { nome: novoNome.trim(), origem: "voce" }
    // MOCK: Bancos e Tags ainda não têm rota de API -- só Categorias e
    // Subcategorias foram ligadas ao backend real (ver AbaCategorias/AbaSubcategorias).
    setDados((d) => {
      if (subtab === "bancos") return { ...d, bancos: [...d.bancos, item] }
      if (subtab === "tags") return { ...d, tags: [...d.tags, item] }
      return d
    })
    setNovoNome("")
  }

  return (
    <Stage
      eyebrow="Cadastros"
      title="Bancos, categorias, subcategorias e tags"
      description="Categorias e subcategorias compartilhadas com todos os seus clientes ficam aqui. Cada cliente também pode criar categorias só dele, na área dele."
    >
      <div className="mb-5">
        <Tabs
          options={[
            { value: "bancos", label: "Bancos" },
            { value: "categorias", label: "Categorias" },
            { value: "subcategorias", label: "Subcategorias" },
            { value: "tags", label: "Tags" },
          ]}
          active={subtab}
          onChange={setSubtab}
        />
      </div>

      {subtab === "categorias" && <AbaCategorias />}
      {subtab === "subcategorias" && <AbaSubcategorias />}

      {subtab === "bancos" && (
        <>
          <Card className="mb-5">
            <form onSubmit={adicionar} className="flex gap-3 items-end">
              <div className="flex-1">
                <Field label="Novo banco/instituição" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="ex: Sicredi" />
              </div>
              <Button type="submit">Adicionar</Button>
            </form>
          </Card>
          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Cadastrados</div>
            <PillList items={dados.bancos} />
            <p className="text-text-faint text-[11px] mt-3">Ainda não persiste — sem rota de API pra bancos.</p>
          </Card>
        </>
      )}

      {subtab === "tags" && (
        <>
          <Card className="mb-5">
            <form onSubmit={adicionar} className="flex gap-3 items-end">
              <div className="flex-1">
                <Field label="Nova tag" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="ex: Viagem 2026" />
              </div>
              <Button type="submit">Adicionar</Button>
            </form>
          </Card>
          <Card>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Cadastradas por você</div>
            <PillList items={dados.tags} />
            <p className="text-text-faint text-[11px] mt-3">
              Tags não têm padrão do sistema — são 100% livres. Ainda não persiste — sem rota de API pra tags.
            </p>
          </Card>
        </>
      )}
    </Stage>
  )
}
