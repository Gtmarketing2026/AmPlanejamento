import { useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field, { Select } from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import Tabs from "../../components/ui/Tabs"
import { cadastrosMockInicial } from "../../mocks/cadastros.mock"

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

export default function CadastrosPage() {
  const [subtab, setSubtab] = useState("bancos")
  const [dados, setDados] = useState(cadastrosMockInicial)
  const [novoNome, setNovoNome] = useState("")
  const [novoTipo, setNovoTipo] = useState("saida")
  const [categoriaMae, setCategoriaMae] = useState(Object.keys(cadastrosMockInicial.subcategorias)[0])

  function adicionar(e) {
    e.preventDefault()
    if (!novoNome.trim()) return
    const item = { nome: novoNome.trim(), origem: "voce" }

    // MOCK: adiciona só em estado local (nao persiste) -- nao ha rota de
    // POST /categorias, /subcategorias, /instituicoes ou /tags ainda.
    setDados((d) => {
      if (subtab === "bancos") return { ...d, bancos: [...d.bancos, item] }
      if (subtab === "categorias") return { ...d, categorias: [...d.categorias, item] }
      if (subtab === "tags") return { ...d, tags: [...d.tags, item] }
      if (subtab === "subcategorias") {
        return {
          ...d,
          subcategorias: {
            ...d.subcategorias,
            [categoriaMae]: [...(d.subcategorias[categoriaMae] || []), item],
          },
        }
      }
      return d
    })
    setNovoNome("")
  }

  return (
    <Stage
      eyebrow="Cadastros"
      title="Bancos, categorias, subcategorias e tags"
      description="Lista padrão do sistema já vem pronta. Itens novos aqui ficam só nesta sessão (não persistem) — ainda não existe rota de API pra esse cadastro."
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

      <Card className="mb-5">
        <form onSubmit={adicionar} className="flex gap-3 items-end">
          {subtab === "subcategorias" && (
            <Select label="Categoria mãe" value={categoriaMae} onChange={(e) => setCategoriaMae(e.target.value)} className="w-56">
              {Object.keys(dados.subcategorias).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
          <div className="flex-1">
            <Field
              label={
                {
                  bancos: "Novo banco/instituição",
                  categorias: "Nova categoria",
                  subcategorias: "Nova subcategoria",
                  tags: "Nova tag",
                }[subtab]
              }
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="ex: Sicredi"
            />
          </div>
          {subtab === "categorias" && (
            <Select label="Tipo" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} className="w-32">
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
              <option value="neutra">Neutra</option>
            </Select>
          )}
          <Button type="submit">Adicionar</Button>
        </form>
      </Card>

      {subtab === "bancos" && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Cadastrados</div>
          <PillList items={dados.bancos} />
        </Card>
      )}

      {subtab === "categorias" && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Cadastradas</div>
          <PillList items={dados.categorias} />
        </Card>
      )}

      {subtab === "subcategorias" && (
        <div className="space-y-4">
          {Object.entries(dados.subcategorias).map(([categoria, itens]) => (
            <Card key={categoria}>
              <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">{categoria}</div>
              <PillList items={itens} />
            </Card>
          ))}
        </div>
      )}

      {subtab === "tags" && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Cadastradas por você</div>
          <PillList items={dados.tags} />
          <p className="text-text-faint text-[11px] mt-3">
            Tags não têm padrão do sistema — são 100% livres, específicas da sua forma de organizar.
          </p>
        </Card>
      )}
    </Stage>
  )
}
