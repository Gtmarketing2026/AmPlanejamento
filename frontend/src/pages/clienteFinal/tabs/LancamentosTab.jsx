import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import EditorCategoria from "../../../components/ui/EditorCategoria"
import Pill from "../../../components/ui/Pill"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import {
  atualizarMinhaTransacao,
  criarMinhaTransacao,
  enviarTransacaoEmpresa,
  excluirMinhaTransacao,
  minhasCategorias,
  minhasSubcategorias,
  minhasTransacoes,
} from "../../../api/clientes"
import { formatarData, formatarMoeda } from "../../../lib/format"
import { exportarCsv } from "../../../lib/exportar"

const NOME_CATEGORIA_EMPRESA = "Empresa e autônomo"

export default function LancamentosTab({ token, contexto = "PF", temCnpj = false }) {
  const qc = useQueryClient()
  const [busca, setBusca] = useState("")
  const [tipoFiltro, setTipoFiltro] = useState("")
  const [verPrevistos, setVerPrevistos] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erro, setErro] = useState(null)
  const [novo, setNovo] = useState({
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
    valor: "",
    tipo: "saida",
    categoria_id: "",
  })

  const filtros = {
    busca: busca || undefined,
    tipo: tipoFiltro || undefined,
    incluir_previstos: verPrevistos ? "true" : undefined,
    contexto,
  }

  const { data: transacoes = [] } = useQuery({
    queryKey: ["cliente-eu-transacoes", token, filtros],
    queryFn: () => minhasTransacoes(token, filtros),
    enabled: !!token,
  })
  const { data: categorias } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  const { data: subcategorias } = useQuery({
    queryKey: ["cliente-eu-subcategorias", token],
    queryFn: () => minhasSubcategorias(token),
    enabled: !!token,
  })

  const [mensagemReclassificacao, setMensagemReclassificacao] = useState(null)
  const [promptEmpresa, setPromptEmpresa] = useState(null) // id da transação a mandar pro PJ

  const empresaCategoriaId = (categorias || []).find((c) => c.nome === NOME_CATEGORIA_EMPRESA)?.id

  const atualizarTransacao = useMutation({
    mutationFn: ({ id, dados }) => atualizarMinhaTransacao(token, id, dados),
    onSuccess: (resposta, variables) => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      if (resposta?.quantidade_atualizada) {
        setMensagemReclassificacao(
          `Categoria aplicada a mais ${resposta.quantidade_atualizada} lançamento(s) igual(is).`
        )
        setTimeout(() => setMensagemReclassificacao(null), 3500)
      }
      // Classificou como empresa e o cliente tem CNPJ: oferece mandar pro PJ.
      if (
        temCnpj &&
        contexto === "PF" &&
        empresaCategoriaId &&
        variables?.dados?.categoria_id === empresaCategoriaId
      ) {
        setPromptEmpresa(variables.id)
      }
    },
  })

  const enviarEmpresa = useMutation({
    mutationFn: ({ id, acao }) => enviarTransacaoEmpresa(token, id, acao),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      setPromptEmpresa(null)
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaTransacao(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] }),
  })

  const criar = useMutation({
    mutationFn: () =>
      criarMinhaTransacao(token, {
        data: novo.data,
        descricao: novo.descricao,
        valor: Number(novo.valor),
        tipo: novo.tipo,
        categoria_id: novo.categoria_id || null,
        contexto,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      setNovo({ data: new Date().toISOString().slice(0, 10), descricao: "", valor: "", tipo: "saida", categoria_id: "" })
      setMostrarForm(false)
      setErro(null)
    },
    onError: (e) => setErro(e.message || "Não foi possível adicionar."),
  })

  function exportar() {
    const linhas = transacoes.map((t) => ({
      data: t.data,
      descricao: t.descricao,
      tipo: t.tipo,
      valor: t.valor,
    }))
    exportarCsv("lancamentos.csv", linhas)
  }

  return (
    <Card>
      {promptEmpresa && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPromptEmpresa(null)}>
          <div className="bg-panel border border-line rounded-[12px] p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-medium mb-1">Lançar no controle da empresa?</div>
            <p className="text-text-dim text-[13px] mb-4">
              Esse gasto foi classificado como <strong>Empresa e autônomo</strong>. Você pode registrá-lo também no
              controle da empresa (CNPJ).
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => enviarEmpresa.mutate({ id: promptEmpresa, acao: "copiar" })} disabled={enviarEmpresa.isPending}>
                Copiar — fica no Pessoal e na Empresa
              </Button>
              <Button variant="ghost" onClick={() => enviarEmpresa.mutate({ id: promptEmpresa, acao: "mover" })} disabled={enviarEmpresa.isPending}>
                Mover — só no controle da Empresa
              </Button>
              <button onClick={() => setPromptEmpresa(null)} className="text-text-faint hover:text-text text-[12.5px] mt-1">
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
          Lançamentos · você pode ajustar a categoria sugerida
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={exportar} disabled={!transacoes.length}>
            Exportar (Excel/CSV)
          </Button>
          <Button onClick={() => setMostrarForm((v) => !v)}>
            {mostrarForm ? "Cancelar" : "+ Novo lançamento"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap mb-4">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição…"
          className="flex-1 min-w-[200px] bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/60"
        />
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className="bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text outline-none focus:border-accent/60"
        >
          <option value="">Todos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
        </select>
        <label className="flex items-center gap-2 text-[12.5px] text-text-dim cursor-pointer select-none">
          <input
            type="checkbox"
            checked={verPrevistos}
            onChange={(e) => setVerPrevistos(e.target.checked)}
            className="accent-accent"
          />
          Mostrar parcelas futuras (previstas)
        </label>
      </div>

      {mostrarForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (novo.descricao.trim() && novo.valor) criar.mutate()
          }}
          className="border border-line rounded-[9px] p-4 mb-4"
        >
          <div className="flex gap-3 flex-wrap items-start">
            <div className="w-40">
              <Field
                label="Data"
                type="date"
                value={novo.data}
                onChange={(e) => setNovo((n) => ({ ...n, data: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Field
                label="Descrição"
                value={novo.descricao}
                onChange={(e) => setNovo((n) => ({ ...n, descricao: e.target.value }))}
                placeholder="ex: Feira livre"
              />
            </div>
            <div className="w-32">
              <Field
                label="Valor (R$)"
                type="number"
                value={novo.valor}
                onChange={(e) => setNovo((n) => ({ ...n, valor: e.target.value }))}
              />
            </div>
            <div className="w-32">
              <Select
                label="Tipo"
                value={novo.tipo}
                onChange={(e) => setNovo((n) => ({ ...n, tipo: e.target.value }))}
              >
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </Select>
            </div>
            <div className="w-48">
              <Select
                label="Categoria"
                value={novo.categoria_id}
                onChange={(e) => setNovo((n) => ({ ...n, categoria_id: e.target.value }))}
              >
                <option value="">Sem categoria</option>
                {(categorias || [])
                  .filter((c) => c.tipo === novo.tipo || c.tipo === "neutra")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
          {erro && <p className="text-red text-[12.5px] mb-2">{erro}</p>}
          <Button type="submit" disabled={!novo.descricao.trim() || !novo.valor || criar.isPending}>
            {criar.isPending ? "Adicionando…" : "Adicionar"}
          </Button>
        </form>
      )}

      {mensagemReclassificacao && (
        <div className="bg-accent/10 text-accent text-[12.5px] rounded-[9px] px-3.5 py-2 mb-3">
          {mensagemReclassificacao}
        </div>
      )}

      <Table>
        <Thead>
          <Th>Data</Th>
          <Th>Descrição</Th>
          <Th>Categoria</Th>
          <Th className="text-right">Valor</Th>
          <Th></Th>
        </Thead>
        <tbody>
          {transacoes.map((t) => (
            <Tr key={t.id} className={t.previsto ? "opacity-60" : ""}>
              <Td className="font-mono text-text-dim">{formatarData(t.data)}</Td>
              <Td>
                <span className="flex items-center gap-2">
                  {t.descricao}
                  {t.previsto && <Pill variant="neutral">Previsto</Pill>}
                </span>
              </Td>
              <Td>
                {t.previsto ? (
                  <span className="text-text-faint text-[12px]">—</span>
                ) : (
                  <EditorCategoria
                    categoriaId={t.categoria_id}
                    subcategoriaId={t.subcategoria_id}
                    categorias={categorias}
                    subcategorias={subcategorias}
                    disabled={atualizarTransacao.isPending}
                    onChange={(dados) => atualizarTransacao.mutate({ id: t.id, dados })}
                  />
                )}
              </Td>
              <Td className={`text-right font-mono ${t.tipo === "entrada" ? "text-accent" : "text-red"}`}>
                {t.tipo === "entrada" ? "+ " : "- "}
                {formatarMoeda(Math.abs(Number(t.valor)))}
              </Td>
              <Td className="text-right">
                {!t.previsto && (
                  <button
                    onClick={() => confirm("Excluir este lançamento?") && excluir.mutate(t.id)}
                    className="text-text-faint hover:text-red text-[12px]"
                  >
                    Excluir
                  </button>
                )}
              </Td>
            </Tr>
          ))}
          {!transacoes.length && (
            <Tr>
              <Td colSpan={5} className="text-text-faint text-center py-6">
                {busca || tipoFiltro
                  ? "Nenhum lançamento encontrado com esse filtro."
                  : "Nenhum lançamento ainda — importe um extrato ou adicione manualmente."}
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </Card>
  )
}
