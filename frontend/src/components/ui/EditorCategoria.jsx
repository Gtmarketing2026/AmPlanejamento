import { useState } from "react"
import Button from "./Button"
import { Select } from "./Field"

// Chip clicável (ícone + categoria em cima, subcategoria embaixo) que abre um
// modal pra trocar a categoria/subcategoria do lançamento -- usado tanto no
// painel do cliente quanto na visão do planejador por cliente.
export default function EditorCategoria({
  categoriaId,
  subcategoriaId,
  categorias,
  subcategorias,
  disabled,
  onChange,
}) {
  const [aberto, setAberto] = useState(false)
  const [catTemp, setCatTemp] = useState(categoriaId || "")
  const [subTemp, setSubTemp] = useState(subcategoriaId || "")
  const [aplicarTodos, setAplicarTodos] = useState(false)

  const categoria = categorias?.find((c) => c.id === categoriaId)
  const subcategoria = subcategorias?.find((s) => s.id === subcategoriaId)
  const subcategoriasDaCategoriaTemp = subcategorias?.filter((s) => s.categoria_id === catTemp) ?? []

  function abrir() {
    setCatTemp(categoriaId || "")
    setSubTemp(subcategoriaId || "")
    setAplicarTodos(false)
    setAberto(true)
  }

  function salvar() {
    onChange({
      categoria_id: catTemp || null,
      subcategoria_id: subTemp || null,
      aplicar_a_todos_iguais: aplicarTodos,
    })
    setAberto(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={disabled}
        className="flex items-center gap-2 text-left px-2 py-1 rounded-[7px] hover:bg-panel-2 disabled:opacity-50"
      >
        <span className="text-[15px]">{categoria?.icone || "🏷️"}</span>
        <div className="leading-tight">
          <div className="text-[12.5px] text-text">{categoria?.nome || "Sem categoria"}</div>
          <div className="text-[10.5px] text-text-faint">{subcategoria?.nome || "Sem classificação"}</div>
        </div>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="bg-panel border border-line rounded-[14px] p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[15px] font-semibold">Categorizar lançamento</h3>
              <button onClick={() => setAberto(false)} className="text-text-faint hover:text-text">
                ✕
              </button>
            </div>

            <Select
              label="Categoria"
              value={catTemp}
              onChange={(e) => {
                setCatTemp(e.target.value)
                setSubTemp("")
              }}
            >
              <option value="">Sem categoria</option>
              {categorias?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icone ? `${c.icone} ` : ""}
                  {c.nome}
                </option>
              ))}
            </Select>

            <Select label="Subcategoria" value={subTemp} onChange={(e) => setSubTemp(e.target.value)}>
              <option value="">Sem classificação</option>
              {subcategoriasDaCategoriaTemp.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>

            <label className="flex items-center gap-2 mb-4 text-[12.5px] text-text-dim cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aplicarTodos}
                onChange={(e) => setAplicarTodos(e.target.checked)}
                className="accent-accent"
              />
              Aplicar a todos os lançamentos com esta descrição
            </label>

            <div className="flex items-center gap-2">
              <Button onClick={salvar}>Salvar</Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
