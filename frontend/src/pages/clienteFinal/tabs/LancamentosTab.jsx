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
  criarMinhaTag,
  criarMinhaTransacao,
  enviarTransacaoEmpresa,
  excluirMinhaTag,
  excluirMinhaTransacao,
  minhasCategorias,
  minhasSubcategorias,
  minhasTags,
  minhasTransacoes,
  reclassificarMinhasTransacoes,
} from "../../../api/clientes"
import { listarMinhasContas } from "../../../api/contas"
import { listarMinhasDividas } from "../../../api/patrimonio"
import { formatarData, formatarMoeda } from "../../../lib/format"
import { exportarCsv } from "../../../lib/exportar"

const NOME_CATEGORIA_EMPRESA = "Empresa e autônomo"

// Cores de marca dos bancos mais comuns pro badge do meio de pagamento -- sem
// depender de logos externos (CSP): círculo colorido + inicial/ícone.
const CORES_BANCO = {
  nubank: "#820AD1", nu: "#820AD1", itau: "#EC7000", "itaú": "#EC7000",
  bradesco: "#CC092F", santander: "#EC0000", "banco do brasil": "#F9DD16",
  bb: "#F9DD16", caixa: "#1B54A3", inter: "#FF7A00", c6: "#242424",
  "c6 bank": "#242424", picpay: "#21C25E", "mercado pago": "#00AAE4",
  original: "#00A868", next: "#00E88F", neon: "#00B2FF", pan: "#00A19B",
  will: "#FFD400", "banco pan": "#00A19B", sicoob: "#003641", sicredi: "#3AB54A",
}
function corDoBanco(nome = "") {
  const k = String(nome).toLowerCase().trim()
  for (const [banco, cor] of Object.entries(CORES_BANCO)) if (k.includes(banco)) return cor
  let h = 0
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 52% 42%)`
}

// Monograma de marca dos bancos mais usados (na cor oficial, definida em
// CORES_BANCO). Não são os logos registrados -- são marcas-texto originais que
// remetem à identidade de cada banco, sem depender de imagens externas (CSP).
const MARCAS_BANCO = {
  nubank: "nu", nu: "nu", "mercado pago": "mp", picpay: "P$", inter: "i",
  c6: "C6", "c6 bank": "C6", bb: "BB", "banco do brasil": "BB", caixa: "C",
  bradesco: "b", santander: "S", "itau": "Itaú", "itaú": "Itaú",
  original: "O", next: "n", neon: "N", sicoob: "sc", sicredi: "s",
}
function marcaDoBanco(nome = "") {
  const k = String(nome).toLowerCase().trim()
  for (const [b, txt] of Object.entries(MARCAS_BANCO)) if (k.includes(b)) return txt
  return null
}
// Ícone genérico de banco (prédio com colunas) -- pra conta sem marca conhecida.
function IconeBanco() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21h18M4 21V9l8-5 8 5v12M9 21v-6h6v6" />
    </svg>
  )
}
// Ícone de cartão -- pra qualquer cartão.
function IconeCartao() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}

// Badge do meio de pagamento: círculo na cor do banco. Cartão => ícone de
// cartão; conta => marca do banco (se conhecida) ou ícone genérico de banco.
function BadgeConta({ conta }) {
  if (!conta) {
    return (
      <span className="w-[22px] h-[22px] rounded-full bg-panel-2 border border-line flex items-center justify-center text-text-faint text-[10px] shrink-0">
        –
      </span>
    )
  }
  const base = conta.banco || conta.nome_exibicao || ""
  const cor = corDoBanco(base)
  const marca = conta.natureza === "cartao" ? null : marcaDoBanco(base)
  return (
    <span
      className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden"
      style={{ background: cor }}
      aria-hidden
    >
      {conta.natureza === "cartao" ? (
        <IconeCartao />
      ) : marca ? (
        <span className={`font-bold leading-none ${marca.length > 2 ? "text-[7.5px]" : "text-[10px]"}`}>{marca}</span>
      ) : (
        <IconeBanco />
      )}
    </span>
  )
}
function nomeConta(conta) {
  if (!conta) return "Sem conta"
  return conta.nome_exibicao || (conta.natureza === "cartao" ? "Cartão" : "Conta")
}

// Cor estável por tag (hash do nome) -- mesma tag sempre com a mesma cor,
// sem precisar guardar cor no banco.
function corDaTag(nome = "") {
  let h = 0
  for (const c of String(nome).toLowerCase()) h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 60% 45%)`
}

// Seletor de tags de um lançamento: mostra as tags aplicadas como chips
// (com "×" pra remover) e um "+" que abre um popover pra escolher entre as
// tags existentes do planejador ou criar uma nova na hora.
function TagSeletor({ transacao, todasTags, aberto, onAbrir, onFechar, onToggle, onCriar, criando }) {
  const [busca, setBusca] = useState("")
  const tagIds = new Set((transacao.tags || []).map((t) => t.id))
  const filtradas = todasTags.filter((t) => t.nome.toLowerCase().includes(busca.toLowerCase()))
  const nomeExato = todasTags.some((t) => t.nome.toLowerCase() === busca.trim().toLowerCase())

  return (
    <div className="relative flex items-center gap-1 flex-wrap">
      {(transacao.tags || []).map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium text-white"
          style={{ background: corDaTag(t.nome) }}
        >
          {t.nome}
          <button
            onClick={() => onToggle(t.id, false)}
            title="Remover tag"
            className="hover:opacity-70 leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <button
        onClick={() => (aberto ? onFechar() : onAbrir())}
        title="Adicionar tag"
        className="w-5 h-5 flex items-center justify-center rounded-full border border-line text-text-faint hover:text-text hover:border-text-faint text-[12px] leading-none"
      >
        +
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={onFechar} />
          <div className="absolute left-0 top-6 z-50 w-52 bg-panel border border-line rounded-[10px] shadow-xl p-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar ou criar tag…"
              className="w-full bg-bg border border-line rounded-[7px] px-2.5 py-1.5 text-[12px] text-text placeholder:text-text-faint outline-none focus:border-accent/60 mb-1.5"
            />
            <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
              {filtradas.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onToggle(t.id, !tagIds.has(t.id))}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[6px] hover:bg-panel-2 text-left"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center text-white text-[8px]"
                    style={{ background: corDaTag(t.nome) }}
                  >
                    {tagIds.has(t.id) ? "✓" : ""}
                  </span>
                  <span className="text-[12px] text-text truncate">{t.nome}</span>
                </button>
              ))}
              {!filtradas.length && !busca && (
                <p className="text-text-faint text-[11.5px] px-2 py-1.5">Nenhuma tag ainda.</p>
              )}
            </div>
            {busca.trim() && !nomeExato && (
              <button
                onClick={() => onCriar(busca.trim())}
                disabled={criando}
                className="w-full text-left text-accent text-[12px] px-2 py-1.5 rounded-[6px] hover:bg-panel-2 mt-1 border-t border-line pt-2"
              >
                {criando ? "Criando…" : `+ Criar "${busca.trim()}"`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Cabeçalho de coluna clicável -- ordena por aquela coluna e alterna ▲/▼.
function ThOrd({ campo, ordenacao, onSort, alinhar = "", children }) {
  const ativo = ordenacao.campo === campo
  const seta = ativo ? (ordenacao.dir === "asc" ? "▲" : "▼") : "↕"
  return (
    <Th className={alinhar}>
      <button
        type="button"
        onClick={() => onSort(campo)}
        title="Ordenar (clique de novo para inverter)"
        className={`inline-flex items-center gap-1 hover:text-text ${
          alinhar === "text-right" ? "flex-row-reverse" : ""
        } ${ativo ? "text-accent" : ""}`}
      >
        {children}
        <span className={`text-[9px] ${ativo ? "" : "text-text-faint opacity-50"}`}>{seta}</span>
      </button>
    </Th>
  )
}
const FILTROS_VAZIO = {
  tipo: "",
  categoria_id: "",
  subcategoria_id: "",
  conta_conectada_id: "",
  data_inicio: "",
  data_fim: "",
  mes_referencia: "", // atalho de mês -- filtra pelo mês em que o lançamento CONTA (respeita virada do cartão), não pela data de compra
  importacao_id: "", // filtra pelos lançamentos de uma importação específica (vindo da aba Importar)
  tag_id: "",
}

const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

// Dois controles separados pra ficar claro: um botão "Todo o período" e um
// navegador de Mês/ano. `valor` = "" (todo o período) ou "AAAA-MM".
function SeletorMesRapido({ valor, onChange }) {
  const hoje = new Date()
  const todo = !valor
  const [ano, mes] = valor ? valor.split("-").map(Number) : [hoje.getFullYear(), hoje.getMonth() + 1]

  function ir(delta) {
    const d = new Date(ano, mes - 1 + delta, 1)
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("")}
        className={`px-3.5 py-2 rounded-[9px] text-[12.5px] font-medium border transition-colors ${
          todo ? "bg-accent text-[#062019] border-accent" : "border-line text-text-dim hover:text-text"
        }`}
      >
        Todo o período
      </button>
      <div
        className={`inline-flex items-center gap-0.5 rounded-[9px] px-1 py-1 border ${
          todo ? "bg-bg border-line" : "bg-bg border-accent/60"
        }`}
        title="Filtrar por um mês específico"
      >
        <button
          type="button"
          onClick={() => ir(-1)}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-panel-2"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onChange(`${ano}-${String(mes).padStart(2, "0")}`)}
          className={`text-[13px] px-1.5 min-w-[118px] text-center capitalize ${todo ? "text-text-faint" : "text-text"}`}
        >
          {MESES_EXTENSO[mes - 1]} de {ano}
        </button>
        <button
          type="button"
          onClick={() => ir(1)}
          className="w-6 h-6 flex items-center justify-center rounded-[6px] text-text-dim hover:text-text hover:bg-panel-2"
        >
          ›
        </button>
      </div>
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
// Ícones da barra de ações (versão minimalista -- botões viram ícones).
function SvgAcao({ children }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
const IconeReclassificar = () => (
  <SvgAcao><path d="M10 3.5 11.4 7l3.6 1.4L11.4 9.8 10 13.3 8.6 9.8 5 8.4 8.6 7 10 3.5Z" /><path d="M15.5 13.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" /></SvgAcao>
)
const IconeExportar = () => (
  <SvgAcao><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5M4 15h12" /></SvgAcao>
)
const IconeMais = () => (
  <SvgAcao><path d="M10 4v12M4 10h12" /></SvgAcao>
)

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
    importacao_id: f.importacao_id || undefined,
    tag_id: f.tag_id || undefined,
    data_inicio: f.data_inicio || undefined,
    data_fim: f.data_fim || undefined,
    mes_referencia: f.mes_referencia || undefined,
    incluir_previstos: verPrevistos ? "true" : undefined,
    contexto,
  }
  const filtrosAtivos = Object.values(f).filter(Boolean).length

  // Atalho rápido de mês, acima do painel de Filtros detalhado -- filtra por
  // mes_referencia (o mês em que o lançamento CONTA, respeitando a virada do
  // cartão configurada em Configurações), não pela data de compra. É
  // independente do De/Até do painel detalhado, que continua sendo um
  // intervalo literal de data de compra pra ajuste fino.
  const mesFiltro = f.mes_referencia ? f.mes_referencia.slice(0, 7) : ""

  function aplicarMesFiltro(valorMes) {
    setF((x) => ({ ...x, mes_referencia: valorMes ? `${valorMes}-01` : "" }))
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
  const { data: dividas = [] } = useQuery({
    queryKey: ["cliente-eu-dividas", token],
    queryFn: () => listarMinhasDividas(token),
    enabled: !!token,
  })
  const { data: tags = [] } = useQuery({
    queryKey: ["cliente-eu-tags", token],
    queryFn: () => minhasTags(token),
    enabled: !!token,
  })
  const subcategoriasDaCategoria = (subcategorias || []).filter(
    (s) => !f.categoria_id || s.categoria_id === f.categoria_id
  )
  const contaById = useMemo(() => Object.fromEntries(contas.map((c) => [c.id, c])), [contas])
  const nomePorCategoria = useMemo(
    () => Object.fromEntries((categorias || []).map((c) => [c.id, c.nome])),
    [categorias]
  )
  const dividaById = useMemo(() => Object.fromEntries(dividas.map((d) => [d.id, d])), [dividas])
  const dividasAtivas = useMemo(() => dividas.filter((d) => d.status !== "quitada"), [dividas])
  // Categorias que representam dívida/financiamento (pra oferecer o abatimento).
  const catsDivida = useMemo(
    () =>
      new Set(
        (categorias || [])
          .filter((c) => ["Dívidas", "Financiamentos"].includes(c.nome))
          .map((c) => c.id)
      ),
    [categorias]
  )
  // Financiamentos (imóvel/veículo) ativos com parcela conhecida -- pra oferecer
  // abatimento automático quando um lançamento casar com o valor da prestação.
  const financiamentos = useMemo(
    () =>
      dividasAtivas.filter(
        (d) => ["financiamento_imobiliario", "financiamento_veiculo"].includes(d.tipo) && d.parcelas_totais > 0
      ),
    [dividasAtivas]
  )
  // Devolve o financiamento cuja prestação bate com este lançamento (saída, real,
  // ainda não vinculado) -- tolerância de 2% ou R$1 pra pequenas variações.
  function financiamentoQueCasa(t) {
    if (t.previsto || t.divida_id || t.tipo !== "saida") return null
    const v = Math.abs(Number(t.valor))
    return (
      financiamentos.find((d) => {
        const parcela = Number(d.valor_total) / Number(d.parcelas_totais)
        return Math.abs(parcela - v) <= Math.max(1, parcela * 0.02)
      }) || null
    )
  }

  // Qual lançamento está com o seletor de conta aberto (clique no badge).
  const [contaEditId, setContaEditId] = useState(null)
  // Lançamento aguardando escolha de "abater de qual dívida?" (popup).
  const [promptDivida, setPromptDivida] = useState(null)

  // Ordenação da tabela: clicar no cabeçalho ordena por aquela coluna e
  // alterna crescente/decrescente. Padrão: data, mais recente primeiro.
  const [ordenacao, setOrdenacao] = useState({ campo: "data", dir: "desc" })
  function alternarOrdenacao(campo) {
    setOrdenacao((o) =>
      o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }
    )
  }
  const transacoesOrdenadas = useMemo(() => {
    const valor = (t) => {
      switch (ordenacao.campo) {
        case "descricao": return (t.descricao || "").toLowerCase()
        case "categoria": return (nomePorCategoria[t.categoria_id] || "~").toLowerCase()
        case "conta": return nomeConta(contaById[t.conta_conectada_id]).toLowerCase()
        case "valor": return Number(t.valor)
        default: return t.data || "" // data
      }
    }
    const mult = ordenacao.dir === "asc" ? 1 : -1
    return [...transacoes].sort((a, b) => {
      const va = valor(a)
      const vb = valor(b)
      if (va < vb) return -mult
      if (va > vb) return mult
      return 0
    })
  }, [transacoes, ordenacao, nomePorCategoria, contaById])

  // Lançamentos ainda sem categoria (no período/filtro atual) -- alimentam o
  // aviso "N sem categoria" e o atalho "Filtrar" que mostra só eles.
  const [soSemCategoria, setSoSemCategoria] = useState(false)
  const semCategoria = useMemo(
    () => transacoes.filter((t) => !t.categoria_id && !t.previsto),
    [transacoes]
  )
  const transacoesVisiveis = useMemo(
    () => (soSemCategoria ? transacoesOrdenadas.filter((t) => !t.categoria_id && !t.previsto) : transacoesOrdenadas),
    [transacoesOrdenadas, soSemCategoria]
  )

  // Totais da lista filtrada (respeitando busca/filtros/mês/previstos) --
  // neutra e investimento não somam no fluxo, mesmo padrão do resto do app.
  const neutras = useMemo(
    () =>
      new Set(
        (categorias || [])
          .filter((c) => c.tipo === "neutra" || c.tipo === "investimento")
          .map((c) => c.id)
      ),
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
      // Vínculo com dívida mexe no saldo dela -> atualiza a aba Dívidas/Patrimônio.
      if (variables?.dados && "divida_id" in variables.dados) {
        qc.invalidateQueries({ queryKey: ["cliente-eu-dividas", token] })
        qc.invalidateQueries({ queryKey: ["cliente-eu-patrimonio"] })
      }
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
      // Classificou como Dívida/Financiamento e há dívida ativa: oferece abater.
      const novaCat = variables?.dados?.categoria_id
      if (
        novaCat &&
        catsDivida.has(novaCat) &&
        dividasAtivas.length > 0 &&
        !resposta?.divida_id
      ) {
        setPromptDivida(resposta)
      }
    },
  })

  // Vincula/desvincula uma parcela a uma dívida (abate/estorna o saldo dela).
  function vincularDivida(transacaoId, dividaId) {
    atualizarTransacao.mutate({ id: transacaoId, dados: { divida_id: dividaId } })
    setPromptDivida(null)
  }

  // Tags: qual lançamento está com o popover de tags aberto.
  const [tagPopoverId, setTagPopoverId] = useState(null)
  const criarTag = useMutation({
    mutationFn: (nome) => criarMinhaTag(token, nome),
    onSuccess: (tag, nome) => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-tags", token] })
      // Já aplica a tag recém-criada no lançamento que estava com o popover aberto.
      if (tagPopoverId) toggleTag(tagPopoverId, tag.id, true)
    },
  })
  function toggleTag(transacaoId, tagId, incluir) {
    const t = transacoes.find((x) => x.id === transacaoId)
    if (!t) return
    const atuais = (t.tags || []).map((x) => x.id)
    const novos = incluir ? [...new Set([...atuais, tagId])] : atuais.filter((id) => id !== tagId)
    atualizarTransacao.mutate({ id: transacaoId, dados: { tag_ids: novos } })
  }

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

  // Reclassificar por IA os lançamentos visíveis (período/filtro atual).
  const reclassificar = useMutation({
    // Mesma key da classificação pós-importação -> mesmo aviso global no topo
    // (ClienteLayout / useIsMutating(["classificar-ia"])).
    mutationKey: ["classificar-ia"],
    mutationFn: (ids) => reclassificarMinhasTransacoes(token, ids),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      setMensagemReclassificacao(`IA reclassificou ${resp?.reclassificadas ?? 0} lançamento(s).`)
      setTimeout(() => setMensagemReclassificacao(null), 4000)
    },
    onError: () => {
      setMensagemReclassificacao("Não foi possível reclassificar agora. Tente de novo.")
      setTimeout(() => setMensagemReclassificacao(null), 4000)
    },
  })
  function onReclassificar() {
    const ids = transacoes.filter((t) => !t.previsto).map((t) => t.id)
    if (!ids.length) return
    if (
      !confirm(
        `Reclassificar ${ids.length} lançamento(s) deste período com IA? ` +
          `As categorias atuais podem ser substituídas pela sugestão da IA.`
      )
    )
      return
    reclassificar.mutate(ids)
  }

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

      {promptDivida && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPromptDivida(null)}>
          <div className="bg-panel border border-line rounded-[12px] p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-medium mb-1">Abater de qual dívida?</div>
            <p className="text-text-dim text-[13px] mb-4">
              Este lançamento de <strong>{formatarMoeda(Math.abs(Number(promptDivida.valor)))}</strong> pode abater o
              saldo de uma dívida cadastrada. Escolha qual (ou deixe sem abater).
            </p>
            <div className="flex flex-col gap-2">
              {dividasAtivas.map((d) => (
                <button
                  key={d.id}
                  onClick={() => vincularDivida(promptDivida.id, d.id)}
                  disabled={atualizarTransacao.isPending}
                  className="flex items-center justify-between border border-line rounded-[9px] px-3.5 py-2.5 text-left hover:border-accent/60"
                >
                  <span className="text-[13px] text-text">{d.credor}</span>
                  <span className="text-[11.5px] text-text-faint font-mono">
                    restam {formatarMoeda(d.valor_restante)}
                  </span>
                </button>
              ))}
              <button onClick={() => setPromptDivida(null)} className="text-text-faint hover:text-text text-[12.5px] mt-1">
                Não abater de nenhuma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de lançamentos sem categoria + atalho pra filtrar só eles. */}
      {semCategoria.length > 0 && !soSemCategoria && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-[9px] border border-amber/40 bg-amber/10 px-3.5 py-2.5">
          <span className="text-[12.5px] text-text flex items-center gap-2">
            <span className="text-[15px]">⚠️</span>
            {semCategoria.length} lançamento{semCategoria.length === 1 ? "" : "s"} sem categoria
            {mesFiltro ? " neste mês" : ""}.
          </span>
          <button
            onClick={() => setSoSemCategoria(true)}
            className="text-amber text-[12.5px] font-semibold hover:underline whitespace-nowrap"
          >
            Filtrar
          </button>
        </div>
      )}
      {soSemCategoria && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-[9px] border border-amber/40 bg-amber/10 px-3.5 py-2.5">
          <span className="text-[12.5px] text-text">
            Mostrando apenas os {semCategoria.length} lançamento{semCategoria.length === 1 ? "" : "s"} sem categoria.
          </span>
          <button
            onClick={() => setSoSemCategoria(false)}
            className="text-amber text-[12.5px] font-semibold hover:underline whitespace-nowrap"
          >
            Ver todos
          </button>
        </div>
      )}

      {f.importacao_id && (
        <div className="flex items-center justify-between gap-3 mb-3 rounded-[9px] border border-accent/40 bg-accent/10 px-3.5 py-2.5">
          <span className="text-[12.5px] text-text">
            Mostrando apenas os lançamentos de uma importação específica.
          </span>
          <button
            onClick={() => setF((x) => ({ ...x, importacao_id: "" }))}
            className="text-accent text-[12.5px] font-semibold hover:underline whitespace-nowrap"
          >
            Ver todos os lançamentos
          </button>
        </div>
      )}

      <div className="flex gap-3 flex-wrap mb-3 items-center">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar…"
          className="w-48 max-w-full h-9 bg-bg border border-line rounded-[9px] px-3 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/60"
        />
        <button
          onClick={() => setMostrarFiltros((v) => !v)}
          title="Filtros"
          className={`h-9 px-3 rounded-[9px] border text-[13px] flex items-center gap-1.5 ${
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

        {/* Ações à direita, na MESMA linha da busca/filtros (antes ficavam
            sozinhas numa linha só delas, deixando um vazio grande à esquerda). */}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onReclassificar}
            disabled={!transacoes.length || reclassificar.isPending}
            title="Reclassificar as categorias deste período com IA"
            className="w-9 h-9 flex items-center justify-center rounded-[9px] border border-line text-text-dim hover:text-accent hover:border-accent/50 disabled:opacity-40 disabled:hover:text-text-dim disabled:hover:border-line"
          >
            {reclassificar.isPending ? (
              <span className="w-4 h-4 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
            ) : (
              <IconeReclassificar />
            )}
          </button>
          <button
            onClick={exportar}
            disabled={!transacoes.length}
            title="Exportar para Excel/CSV"
            className="w-9 h-9 flex items-center justify-center rounded-[9px] border border-line text-text-dim hover:text-text hover:border-text-faint disabled:opacity-40"
          >
            <IconeExportar />
          </button>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            title={mostrarForm ? "Cancelar" : "Novo lançamento"}
            className={`w-9 h-9 flex items-center justify-center rounded-[9px] transition-colors ${
              mostrarForm
                ? "bg-panel-2 border border-line text-text"
                : "bg-accent text-[#062019] hover:brightness-105"
            }`}
          >
            {mostrarForm ? "✕" : <IconeMais />}
          </button>
        </div>
      </div>

      <div className="text-right text-[11px] text-text-faint uppercase tracking-wide font-mono -mt-1 mb-3">
        você pode ajustar a categoria sugerida
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
          <Select
            label="Tag"
            value={f.tag_id}
            onChange={(e) => setF((x) => ({ ...x, tag_id: e.target.value }))}
          >
            <option value="">Todas</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
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
                  .filter(
                    (c) =>
                      c.tipo === novo.tipo ||
                      c.tipo === "neutra" ||
                      c.tipo === "investimento"
                  )
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
          <ThOrd campo="data" ordenacao={ordenacao} onSort={alternarOrdenacao}>Data</ThOrd>
          <ThOrd campo="descricao" ordenacao={ordenacao} onSort={alternarOrdenacao}>Descrição</ThOrd>
          <ThOrd campo="categoria" ordenacao={ordenacao} onSort={alternarOrdenacao}>Categoria</ThOrd>
          <ThOrd campo="conta" ordenacao={ordenacao} onSort={alternarOrdenacao}>Meio de pagamento</ThOrd>
          <Th>Tags</Th>
          <ThOrd campo="valor" ordenacao={ordenacao} onSort={alternarOrdenacao} alinhar="text-right">Valor</ThOrd>
          <Th></Th>
        </Thead>
        <tbody>
          {transacoesVisiveis.map((t) => (
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
                  <>
                    <EditorCategoria
                      categoriaId={t.categoria_id}
                      subcategoriaId={t.subcategoria_id}
                      categorias={categorias}
                      subcategorias={subcategorias}
                      disabled={atualizarTransacao.isPending}
                      onChange={(dados) => atualizarTransacao.mutate({ id: t.id, dados })}
                    />
                    {t.divida_id && (
                      <span className="flex items-center gap-1 text-[10.5px] text-text-faint mt-0.5">
                        ↳ abate: {dividaById[t.divida_id]?.credor || "dívida"}
                        <button
                          onClick={() => vincularDivida(t.id, null)}
                          title="Desvincular (estorna o abatimento)"
                          className="hover:text-red"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                    {!t.divida_id &&
                      (() => {
                        const fin = financiamentoQueCasa(t)
                        return fin ? (
                          <button
                            onClick={() => vincularDivida(t.id, fin.id)}
                            title={`Abater esta parcela do financiamento (${fin.credor})`}
                            className="flex items-center gap-1 text-[10.5px] text-accent mt-0.5 hover:underline text-left"
                          >
                            ↳ abater parcela de {fin.credor}?
                          </button>
                        ) : null
                      })()}
                  </>
                )}
              </Td>
              <Td>
                {t.previsto ? (
                  <span className="text-text-faint text-[12px]">—</span>
                ) : contaEditId === t.id ? (
                  <select
                    autoFocus
                    value={t.conta_conectada_id || ""}
                    onChange={(e) => {
                      atualizarTransacao.mutate({
                        id: t.id,
                        dados: { conta_conectada_id: e.target.value || null },
                      })
                      setContaEditId(null)
                    }}
                    onBlur={() => setContaEditId(null)}
                    disabled={atualizarTransacao.isPending}
                    className="bg-bg border border-line rounded-[7px] px-2 py-1 text-[12px] text-text-dim outline-none focus:border-accent/60 max-w-[160px]"
                  >
                    <option value="">Sem conta</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {nomeConta(c)}
                        {c.natureza === "cartao" ? " (cartão)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setContaEditId(t.id)}
                    className="flex items-center gap-2 group max-w-[170px]"
                    title="Clique para trocar a conta/cartão"
                  >
                    <BadgeConta conta={contaById[t.conta_conectada_id]} />
                    <span
                      className={`truncate text-[12.5px] ${
                        t.conta_conectada_id ? "text-text-dim group-hover:text-text" : "text-text-faint"
                      }`}
                    >
                      {nomeConta(contaById[t.conta_conectada_id])}
                    </span>
                  </button>
                )}
              </Td>
              <Td>
                {t.previsto ? (
                  <span className="text-text-faint text-[12px]">—</span>
                ) : (
                  <TagSeletor
                    transacao={t}
                    todasTags={tags}
                    aberto={tagPopoverId === t.id}
                    onAbrir={() => setTagPopoverId(t.id)}
                    onFechar={() => setTagPopoverId(null)}
                    onToggle={(tagId, incluir) => toggleTag(t.id, tagId, incluir)}
                    onCriar={(nome) => criarTag.mutate(nome)}
                    criando={criarTag.isPending}
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
          {!transacoesVisiveis.length && (
            <Tr>
              <Td colSpan={7} className="text-text-faint text-center py-6">
                {soSemCategoria
                  ? "Tudo classificado neste período! 🎉"
                  : busca || filtrosAtivos
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
