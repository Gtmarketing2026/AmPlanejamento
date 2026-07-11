import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  listarAtualizacoes,
  criarAtualizacao,
  atualizarAtualizacao,
  excluirAtualizacao,
} from "../../api/negocio"
import { formatarData } from "../../lib/format"

const TIPOS = [
  ["novidade", "Novidade"],
  ["melhoria", "Melhoria"],
  ["correcao", "Correção"],
]
const PUBLICOS = [
  ["ambos", "Cliente e planejador"],
  ["cliente", "Só cliente"],
  ["planejador", "Só planejador"],
]
const VAZIO = { titulo: "", descricao: "", tipo: "novidade", publico: "ambos", publicado: false }

export default function NovidadesAdminPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(VAZIO)
  const [editandoId, setEditandoId] = useState(null)

  const { data: notas = [] } = useQuery({
    queryKey: ["negocio-atualizacoes"],
    queryFn: listarAtualizacoes,
  })

  const fechar = () => {
    qc.invalidateQueries({ queryKey: ["negocio-atualizacoes"] })
    setForm(VAZIO)
    setEditandoId(null)
  }
  const salvar = useMutation({
    mutationFn: () => (editandoId ? atualizarAtualizacao(editandoId, form) : criarAtualizacao(form)),
    onSuccess: fechar,
  })
  const alternarPublicado = useMutation({
    mutationFn: ({ id, publicado }) => atualizarAtualizacao(id, { publicado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["negocio-atualizacoes"] }),
  })
  const excluir = useMutation({
    mutationFn: (id) => excluirAtualizacao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["negocio-atualizacoes"] }),
  })

  const inputCls =
    "w-full bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text outline-none focus:border-accent/60"

  function editar(n) {
    setForm({ titulo: n.titulo, descricao: n.descricao, tipo: n.tipo, publico: n.publico, publicado: n.publicado })
    setEditandoId(n.id)
  }

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-8 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-[20px] font-semibold">Novidades do sistema</h1>
        <p className="text-text-dim text-[13px] mt-1">
          Notas de atualização enviadas ao cliente e/ou ao planejador (nova função, melhoria, correção de bug). Nada
          administrativo — só o que eles precisam saber. Só aparece pra eles depois de <strong>publicar</strong>.
        </p>
      </div>

      <div className="bg-panel border border-line rounded-[12px] p-5">
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          {editandoId ? "Editar nota" : "Nova nota"}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (form.titulo.trim() && form.descricao.trim()) salvar.mutate()
          }}
          className="flex flex-col gap-3"
        >
          <input
            className={inputCls}
            placeholder="Título (ex: Nova calculadora de proteção)"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
          />
          <textarea
            className={`${inputCls} min-h-[90px] resize-y`}
            placeholder="O que mudou, em linguagem simples pro usuário."
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
          <div className="flex gap-3 flex-wrap">
            <select className={`${inputCls} w-44`} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
              {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={`${inputCls} w-52`} value={form.publico} onChange={(e) => setForm((f) => ({ ...f, publico: e.target.value }))}>
              {PUBLICOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="flex items-center gap-2 text-[13px] text-text-dim">
              <input type="checkbox" checked={form.publicado} onChange={(e) => setForm((f) => ({ ...f, publicado: e.target.checked }))} />
              Publicar agora
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!form.titulo.trim() || !form.descricao.trim() || salvar.isPending}
              className="px-4 py-2 rounded-[9px] bg-accent text-[#062019] text-[13px] font-semibold disabled:opacity-40"
            >
              {salvar.isPending ? "Salvando…" : editandoId ? "Salvar alterações" : "Criar nota"}
            </button>
            {editandoId && (
              <button type="button" onClick={fechar} className="text-text-faint hover:text-text text-[13px]">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="flex flex-col gap-2">
        {!notas.length && <p className="text-text-faint text-[13px]">Nenhuma nota criada ainda.</p>}
        {notas.map((n) => (
          <div key={n.id} className="bg-panel border border-line rounded-[11px] p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-panel-2 text-text-dim">{n.tipo}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-panel-2 text-text-dim">{n.publico}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${n.publicado ? "bg-accent/15 text-accent" : "bg-amber/15 text-amber"}`}>
                  {n.publicado ? `publicada ${n.publicado_em ? "· " + formatarData(n.publicado_em) : ""}` : "rascunho"}
                </span>
              </div>
              <div className="text-[14px] font-semibold mt-1.5">{n.titulo}</div>
              <div className="text-text-dim text-[12.5px] mt-0.5 whitespace-pre-line">{n.descricao}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                onClick={() => alternarPublicado.mutate({ id: n.id, publicado: !n.publicado })}
                className="text-accent text-[12px] hover:underline"
              >
                {n.publicado ? "Despublicar" : "Publicar"}
              </button>
              <button onClick={() => editar(n)} className="text-text-dim text-[12px] hover:text-text hover:underline">Editar</button>
              <button onClick={() => excluir.mutate(n.id)} className="text-red text-[12px] hover:underline">Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
