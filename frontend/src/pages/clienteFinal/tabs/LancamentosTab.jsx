import { useMemo, useState } from "react"
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
import { listarMinhasContas } from "../../../api/contas"
import { formatarData, formatarMoeda } from "../../../lib/format"
import { exportarCsv } from "../../../lib/exportar"

const NOME_CATEGORIA_EMPRESA = "Empresa e autônomo"
const FILTROS_VAZIO = {
  tipo: "",
  categoria_id: "",
  subcategoria_id: "",
  conta_conectada_id: "",
  data_inicio: "",
  data_fim: "",
}

const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

// Substitui o <input type="month"> nativo -- em alguns navegadores/idiomas
// ele renderiza como "-------- de ----" quando vazio, escondendo o nome do
// mês em vez de mostrá-lo. Aqui o nome do mês (ou "Todos os meses") fica
// sempre visível, com setas pra navegar mês a mês.
function SeletorMesRapido({ valor, onChange }) {
  const hoje = new Date()
  const [ano, mes] = valor ? valor.split("-").map(Number) : [hoje.getFullYear(), hoje.getMonth() + 1]

  function ir(delta) {
    const d = new Date(ano, mes - 1 + delta, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  return (
    <div className="inline-flex items-center gap-0.5 bg-bg border border-line rounded-[9px] px-1 py-1">
      <button
        type="button"
        onClick={() => ir(-1)}
        className="w-6 h-6 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-panel-2"
      >
        ‹
      </button>
      <span className="text-[13px] text-text px-1.5 min-w-[128px] text-center capitalize">
        {valor ? `${MESES_EXTENSO[mes - 1]} de ${ano}` : "Todos os meses"}
      </span>
      <button
        type="button"
        onClick={() => ir(1)}
        className="w-6 h-6 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-panel-2"
      >
        ›
      </button>
      {valor && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Ver todos os meses"
          className="ml-1 w-6 h-6 flex items-center justify-center rounded-[6px] text-text-faint hover:text-text hover:bg-panel-2"
        >
          ✕
        </button>
      )}
    </div>
  )
}

function IconeFunil({ className = "" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="13"
      height="13"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5L2 3z" />
    </svg>
  )
}

export default function LancamentosTab({ token, contexto = "PF", temCnpj = false, filtrosIniciais = null }) {
  const qc = useQueryClient()
  const [busca, setBusca] = useState("")
  // Vindo do Resumo Financeiro (clicou numa Receita/Despesa de um mês): já
  // chega com período/tipo/categoria/conta preenchidos e o painel aberto.
  const [f, setF] = useState(() => ({ ...FILTROS_VAZIO, ...(filtrosIniciais || {}) }))
  const [mostrarFiltros, setMostrarFiltros] = useState(!!filtrosIniciais)
  const [verPrevistos, setVerPrevistos] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [erro, setErro] = useState(null)
  const [novo, setNovo] = useState({
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
    valor: "",
    tipo: "saida",
    categoria_id: "",
    parcelas: 1,
  })

  const filtros = {
    busca: busca || undefined,
    tipo: f.tipo || undefined,
    categoria_id: f.categoria_id || undefined,
    subcategoria_id: f.subcategoria_id || undefined,
    conta_conectada_id: f.conta_conectada_id || undefined,
    data_inicio: f.data_inicio || undefined,
    data_fim: f.data_fim || undefined,
    incluir_previstos: verPrevistos ? "true" : undefined,
    contexto,
  }
  const filtrosAtivos = Object.values(f).filter(Boolean).length

  // Atalho rápido de mês, acima do painel de Filtros detalhado -- reflete
  // De/Até quando eles formam um mês inteiro; escolher aqui já preenche os
  // dois, e abrir "Filtros" permite refinar (data parcial, outro campo etc.).
  const mesFiltro = (() => {
    if (!f.data_inicio || !f.data_fim) return ""
    const [ano, mes, dia] = f.data_inicio.split("-").map(Number)
    if (dia !== 1) return ""
    const ultimoDia = new Date(ano, mes, 0).getDate()
    return f.data_fim === `${f.data_inicio.slice(0, 7)}-${String(ultimoDia).padStart(2, "0")}` ? f.data_inicio.slice(0, 7) : ""
  })()

  function aplicarMesFiltro(valorMes) {
    if (!valorMes) {
      setF((x) => ({ ...x, data_inicio: "", data_fim: "" }))
      return
    }
    const [ano, mes] = valorMes.split("-").map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    setF((x) => ({ ...x, data_inicio: `${valorMes}-01`, data_fim: `${valorMes}-${String(ultimoDia).padStart(2, "0")}` }))
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
  const { data: contas = [] } = useQuery({
    queryKey: ["cliente-eu-contas", token],
    queryFn: () => listarMinhasContas(token),
    enabled: !!token,
  })
  const subcategoriasDaCategoria = (subcategorias || []).filter(
    (s) => !f.categoria_id || s.categoria_id === f.categoria_id
  )

  // Totais da lista filtrada (respeitando busca/filtros/mês/previstos) --
  // classificação neutra não soma, mesmo padrão do resto do app.
  const neutras = useMemo(
    () => new Set((categorias || []).filter((c) => c.tipo === "neutra").map((c) => c.id)),
    [categorias]
  )
  const totais = useMemo(() => {
    let entradas = 0
    let saidas = 0
    for (const t of transacoes) {
      if (neutras.has(t.categoria_id)) continue
      const valor = Math.abs(Number(t.valor))
      if (t.tipo === "entrada") entradas += valor
      else saidas += valor
    }
    return { entradas, saidas, resultado: entradas - saidas }
  }, [transacoes, neutras])

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
        parcelas: Math.max(1, Number(novo.parcelas) || 1),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      setNovo({ data: new Date().toISOString().slice(0, 10), descricao: "", valor: "", tipo: "saida", categoria_id: "", parcelas: 1 })
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

      <div className="flex gap-3 flex-wrap mb-3 items-center">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por descrição…"
          className="flex-1 min-w-[200px] bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/60"
        />
        <button
          onClick={() => setMostrarFiltros((v) => !v)}
          title="Filtros"
          className={`px-3 py-2.5 rounded-[9px] border text-[13px] flex items-center gap-1.5 ${
            filtrosAtivos ? "border-accent/60 text-accent" : "border-line text-text-dim hover:text-text"
          }`}
        >
          <IconeFunil />
          {filtrosAtivos > 0 && (
            <span className="text-[10px] font-mono rounded-full px-1.5 py-0.5 leading-none bg-accent/20 text-accent">
              {filtrosAtivos}
            </span>
          )}
        </button>
        <label className="flex items-center gap-2 text-[12.5px] text-text-dim cursor-pointer select-none">
          <input
            type="checkbox"
            checked={verPrevistos}
            onChange={(e) => setVerPrevistos(e.target.checked)}
            className="accent-accent"
          />
          Parcelas futuras
        </label>
      </div>

      <div className="mb-4">
        <SeletorMesRapido valor={mesFiltro} onChange={aplicarMesFiltro} />
      </div>

      {mostrarFiltros && (
        <div className="border border-line rounded-[9px] p-4 mb-4 grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <Select label="Tipo" value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value }))}>
            <option value="">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </Select>
          <Select
            label="Categoria"
            value={f.categoria_id}
            onChange={(e) => setF((x) => ({ ...x, categoria_id: e.target.value, subcategoria_id: "" }))}
          >
            <option value="">Todas</option>
            {(categorias || []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
          <Select
            label="Subcategoria"
            value={f.subcategoria_id}
            onChange={(e) => setF((x) => ({ ...x, subcategoria_id: e.target.value }))}
          >
            <option value="">Todas</option>
            {subcategoriasDaCategoria.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </Select>
          <Select
            label="Conta / cartão"
            value={f.conta_conectada_id}
            onChange={(e) => setF((x) => ({ ...x, conta_conectada_id: e.target.value }))}
          >
            <option value="">Todas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_exibicao || (c.natureza === "cartao" ? "Cartão" : "Conta")}
                {c.natureza === "cartao" ? " (cartão)" : ""}
              </option>
            ))}
          </Select>
          <Field label="De" type="date" value={f.data_inicio} onChange={(e) => setF((x) => ({ ...x, data_inicio: e.target.value }))} />
          <Field label="Até" type="date" value={f.data_fim} onChange={(e) => setF((x) => ({ ...x, data_fim: e.target.value }))} />
          {filtrosAtivos > 0 && (
            <div className="col-span-3 max-md:col-span-1">
              <button onClick={() => setF(FILTROS_VAZIO)} className="text-text-faint hover:text-text text-[12px]">
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

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
            {novo.tipo === "saida" && (
              <div className="w-28">
                <Field
                  label="Parcelas"
                  type="number"
                  min="1"
                  value={novo.parcelas}
                  onChange={(e) => setNovo((n) => ({ ...n, parcelas: e.target.value }))}
                />
              </div>
            )}
          </div>
          {novo.tipo === "saida" && Number(novo.parcelas) > 1 && Number(novo.valor) > 0 && (
            <p className="text-text-faint text-[11.5px] mb-2">
              {novo.parcelas}x de {formatarMoeda(Number(novo.valor) / Number(novo.parcelas))} · total{" "}
              {formatarMoeda(Number(novo.valor))} — as parcelas futuras aparecem como “previstas”.
            </p>
          )}
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

      {!!transacoes.length && (
        <div className="flex items-center gap-4 flex-wrap text-[12.5px] mb-3 px-0.5">
          <span className="text-text-faint">
            {transacoes.length} lançamento{transacoes.length === 1 ? "" : "s"}
          </span>
          <span className="font-mono text-accent">Entradas: {formatarMoeda(totais.entradas)}</span>
          <span className="font-mono text-red">Saídas: {formatarMoeda(totais.saidas)}</span>
          <span className={`font-mono ${totais.resultado >= 0 ? "text-accent" : "text-red"}`}>
            Resultado: {formatarMoeda(totais.resultado)}
          </span>
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
                {busca || filtrosAtivos
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
