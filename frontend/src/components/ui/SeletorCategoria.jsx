const classeSelect =
  "bg-bg border border-line rounded-[7px] px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-accent/60 max-w-[140px]"

// Dropdown duplo (categoria + subcategoria) usado nos lançamentos, tanto na
// visão do planejador quanto na do cliente final -- ao trocar a categoria, a
// subcategoria é zerada (o conjunto de opções válidas muda).
export default function SeletorCategoria({ categoriaId, subcategoriaId, categorias, subcategorias, onChange, disabled }) {
  const subcategoriasDaCategoria = subcategorias?.filter((s) => s.categoria_id === categoriaId) ?? []

  return (
    <div className="flex gap-1.5">
      <select
        className={classeSelect}
        value={categoriaId ?? ""}
        disabled={disabled}
        onChange={(e) => onChange({ categoria_id: e.target.value || null, subcategoria_id: null })}
      >
        <option value="">Sem categoria</option>
        {categorias?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <select
        className={classeSelect}
        value={subcategoriaId ?? ""}
        disabled={disabled || !categoriaId}
        onChange={(e) => onChange({ categoria_id: categoriaId, subcategoria_id: e.target.value || null })}
      >
        <option value="">—</option>
        {subcategoriasDaCategoria.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
    </div>
  )
}
