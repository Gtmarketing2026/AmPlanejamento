import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import BarRow from "../../../components/ui/BarRow"
import Field, { Select } from "../../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import {
  atualizarMeuInvestimento,
  atualizarMinhaMeta,
  criarMeuInvestimento,
  criarMinhaMeta,
  excluirMeuInvestimento,
  listarMeusInvestimentos,
  listarMinhasMetas,
  obterPlanoInvestimento,
  obterProtecaoMedias,
  salvarPlanoInvestimento,
} from "../../../api/patrimonio"
import { minhasCategorias, minhasTransacoes } from "../../../api/clientes"
import { listarMinhasContas } from "../../../api/contas"
import { formatarData, formatarMoeda } from "../../../lib/format"

const TIPOS = {
  acao: "Ação",
  fundo: "Fundo",
  fii: "FII",
  renda_fixa: "Renda fixa",
  tesouro_direto: "Tesouro Direto",
  previdencia: "Previdência",
  cripto: "Cripto",
  outro: "Outro",
}
const GRUPO = {
  renda_fixa: "Renda Fixa",
  tesouro_direto: "Renda Fixa",
  previdencia: "Renda Fixa",
  acao: "Renda Variável",
  fundo: "Renda Variável",
  fii: "Renda Variável",
  cripto: "Outros",
  outro: "Outros",
}
const LIQUIDEZ_OPCOES = ["Diária", "D+1", "D+30", "D+90", "No vencimento", "Sem vencimento"]
// Classificações (produtos) disponíveis por tipo de investimento. Quando o tipo
// não tem lista fechada (ex: "outro"), o campo vira texto livre.
const CLASSIFICACAO_POR_TIPO = {
  renda_fixa: ["CDB", "LCI", "LCA", "LC", "Debêntures", "CRA", "CRI", "DPGE", "Letra Financeira", "Poupança"],
  tesouro_direto: ["Tesouro Selic", "Tesouro IPCA+", "Tesouro Prefixado", "Título público"],
  previdencia: ["PGBL", "VGBL"],
  acao: ["Ações", "ETF", "BDR"],
  fii: ["FII"],
  fundo: ["Fundo de ações", "Fundo multimercado", "Fundo cambial", "Fundo DI", "Fundo imobiliário", "Fundo de renda fixa"],
  cripto: ["Bitcoin", "Ethereum", "Stablecoin", "Outra cripto"],
  outro: [],
}

const FORM_VAZIO = {
  tipo: "renda_fixa",
  classe_ativo: "",
  nome_ativo: "",
  valor_aplicado: "",
  valor_atual: "",
  instituicao_nome: "",
  liquidez: "",
  data_vencimento: "",
}

export default function InvestimentosTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(FORM_VAZIO)
  const [resgateModo, setResgateModo] = useState("liquidez") // liquidez | vencimento
  const [alocacoes, setAlocacoes] = useState([])
  const [editandoId, setEditandoId] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [busca, setBusca] = useState("")
  const [filtroTipo, setFiltroTipo] = useState("")
  const [filtroInstituicao, setFiltroInstituicao] = useState("")

  const { data: investimentos = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-investimentos", token],
    queryFn: () => listarMeusInvestimentos(token),
    enabled: !!token,
  })
  const { data: metas = [] } = useQuery({
    queryKey: ["cliente-eu-metas", token],
    queryFn: () => listarMinhasMetas(token),
    enabled: !!token,
  })
  // Lançamentos classificados como investimento (categoria tipo='investimento').
  // Ao classificar um gasto como "Investimentos" na aba Lançamentos, ele sai do
  // fluxo de despesas e aparece aqui como aporte.
  const { data: transacoes = [] } = useQuery({
    queryKey: ["cliente-eu-transacoes", token, { contexto: "PF" }],
    queryFn: () => minhasTransacoes(token, { contexto: "PF" }),
    enabled: !!token,
  })
  const { data: categorias = [] } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  // Instituições vêm das contas/cartões que o cliente já cadastrou (aba Contas).
  const { data: contas = [] } = useQuery({
    queryKey: ["cliente-eu-contas", token],
    queryFn: () => listarMinhasContas(token),
    enabled: !!token,
  })
  const instituicoesCadastradas = useMemo(() => {
    const labels = contas.map((c) => {
      const banco = (c.banco || "").trim()
      const nome = (c.nome_exibicao || "").trim()
      if (banco && nome && banco.toLowerCase() !== nome.toLowerCase()) return `${banco} – ${nome}`
      return banco || nome
    })
    return [...new Set(labels.filter(Boolean))]
  }, [contas])
  const catsInvestimento = useMemo(
    () => new Set(categorias.filter((c) => c.tipo === "investimento").map((c) => c.id)),
    [categorias]
  )
  const nomePorCategoria = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nome])),
    [categorias]
  )
  const aportesLancamentos = useMemo(
    () =>
      transacoes
        .filter((t) => !t.previsto && catsInvestimento.has(t.categoria_id))
        .sort((a, b) => (a.data < b.data ? 1 : -1)),
    [transacoes, catsInvestimento]
  )
  const totalAportado = useMemo(
    () => aportesLancamentos.reduce((s, t) => s + Math.abs(Number(t.valor || 0)), 0),
    [aportesLancamentos]
  )

  function limparForm() {
    setForm(FORM_VAZIO)
    setResgateModo("liquidez")
    setAlocacoes([])
    setEditandoId(null)
    setMostrarForm(false)
  }

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        tipo: form.tipo,
        classe_ativo: form.classe_ativo || null,
        nome_ativo: form.nome_ativo,
        valor_aplicado: form.valor_aplicado ? Number(form.valor_aplicado) : null,
        valor_atual: form.valor_atual ? Number(form.valor_atual) : null,
        instituicao_nome: form.instituicao_nome || null,
        // Resgate é um OU outro: no modo liquidez zera o vencimento e vice-versa.
        liquidez: resgateModo === "liquidez" ? form.liquidez || null : null,
        data_vencimento: resgateModo === "vencimento" ? form.data_vencimento || null : null,
        alocacoes: alocacoes
          .filter((a) => a.meta_id && a.valor_alocado)
          .map((a) => ({ meta_id: a.meta_id, valor_alocado: Number(a.valor_alocado) })),
      }
      return editandoId ? atualizarMeuInvestimento(token, editandoId, dados) : criarMeuInvestimento(token, dados)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-investimentos", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      limparForm()
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMeuInvestimento(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-investimentos", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
    },
  })

  function editar(inv) {
    setForm({
      tipo: inv.tipo,
      classe_ativo: inv.classe_ativo || "",
      nome_ativo: inv.nome_ativo,
      valor_aplicado: inv.valor_aplicado ?? "",
      valor_atual: inv.valor_atual ?? "",
      instituicao_nome: inv.instituicao_nome || "",
      liquidez: inv.liquidez || "",
      data_vencimento: inv.data_vencimento || "",
    })
    setResgateModo(inv.data_vencimento ? "vencimento" : "liquidez")
    setAlocacoes(inv.alocacoes.map((a) => ({ meta_id: a.meta_id, valor_alocado: a.valor_alocado })))
    setEditandoId(inv.id)
    setMostrarForm(true)
  }

  function adicionarLinhaAlocacao() {
    setAlocacoes((a) => [...a, { meta_id: "", valor_alocado: "" }])
  }
  function atualizarLinhaAlocacao(i, campo, valor) {
    setAlocacoes((a) => a.map((linha, idx) => (idx === i ? { ...linha, [campo]: valor } : linha)))
  }
  function removerLinhaAlocacao(i) {
    setAlocacoes((a) => a.filter((_, idx) => idx !== i))
  }
  // Aloca por percentual: converte o % informado em valor (R$) usando o valor
  // atual do produto como base. O que fica guardado é sempre o valor; o % é só
  // uma forma de digitar. Ex: 60% de R$ 7,26 -> R$ 4,36.
  function atualizarPctAlocacao(i, pct) {
    const base = Number(form.valor_atual) || 0
    const p = Number(pct)
    const valor = base > 0 && pct !== "" && !isNaN(p) ? Math.round((p / 100) * base * 100) / 100 : ""
    setAlocacoes((a) => a.map((linha, idx) => (idx === i ? { ...linha, valor_alocado: valor } : linha)))
  }

  const totalAlocado = alocacoes.reduce((s, a) => s + (Number(a.valor_alocado) || 0), 0)
  const valorInvestimentoAtual = Number(form.valor_atual) || 0

  const instituicoesDisponiveis = useMemo(
    () => [...new Set(investimentos.map((i) => i.instituicao_nome).filter(Boolean))],
    [investimentos]
  )

  const investimentosFiltrados = investimentos.filter((i) => {
    if (busca && !i.nome_ativo.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroTipo && i.tipo !== filtroTipo) return false
    if (filtroInstituicao && i.instituicao_nome !== filtroInstituicao) return false
    return true
  })

  const total = investimentos.reduce((s, i) => s + Number(i.valor_atual || i.valor_aplicado || 0), 0)
  const porGrupo = { "Renda Fixa": 0, "Renda Variável": 0, Outros: 0 }
  investimentos.forEach((i) => {
    porGrupo[GRUPO[i.tipo]] += Number(i.valor_atual || i.valor_aplicado || 0)
  })
  const metaMensalTotal = metas
    .filter((m) => m.status !== "pausada")
    .reduce((s, m) => s + Number(m.aporte_mensal_meta || 0), 0)

  // ---- Reserva de emergência (auto pela média de gastos, ou manual) ----
  const { data: medias } = useQuery({
    queryKey: ["cliente-eu-protecao-medias", token],
    queryFn: () => obterProtecaoMedias(token),
    enabled: !!token,
  })
  const mediaGastos = medias
    ? Number(medias.obrigatorias || 0) + Number(medias.empresa || 0) + Number(medias.nao_obrigatorias || 0) + Number(medias.projetos || 0)
    : 0
  const reservaMeta = metas.find((m) => m.tipo === "reserva_emergencia")
  const [modalReserva, setModalReserva] = useState(false)
  const [reservaModo, setReservaModo] = useState("auto") // auto | manual
  const [reservaMeses, setReservaMeses] = useState(6)
  const [reservaManual, setReservaManual] = useState("")
  const reservaAlvo = reservaModo === "auto" ? Math.round(mediaGastos * reservaMeses) : Number(reservaManual) || 0
  const salvarReserva = useMutation({
    mutationFn: () => {
      const dados = { titulo: "Reserva de emergência", tipo: "reserva_emergencia", prioridade: "essencial", valor_alvo: reservaAlvo }
      return reservaMeta ? atualizarMinhaMeta(token, reservaMeta.id, dados) : criarMinhaMeta(token, dados)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-metas", token] })
      setModalReserva(false)
    },
  })

  // ---- Distribuição da meta mensal de investimentos (3 baldes) ----
  const { data: planoResp } = useQuery({
    queryKey: ["cliente-eu-plano-investimento", token],
    queryFn: () => obterPlanoInvestimento(token),
    enabled: !!token,
  })
  const [modalPlano, setModalPlano] = useState(false)
  const [plano, setPlano] = useState({ reserva: "", projetos: "", independencia: "" })
  useEffect(() => {
    if (planoResp?.config?.distribuicao) setPlano({ reserva: "", projetos: "", independencia: "", ...planoResp.config.distribuicao })
  }, [planoResp])
  const planoDistribuido = Number(plano.reserva || 0) + Number(plano.projetos || 0) + Number(plano.independencia || 0)
  const planoFalta = Math.max(0, metaMensalTotal - planoDistribuido)
  const salvarPlano = useMutation({
    mutationFn: () =>
      salvarPlanoInvestimento(token, {
        distribuicao: {
          reserva: Number(plano.reserva || 0),
          projetos: Number(plano.projetos || 0),
          independencia: Number(plano.independencia || 0),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-plano-investimento", token] })
      setModalPlano(false)
    },
  })
  function abrirModalReserva() {
    if (reservaMeta?.valor_alvo && mediaGastos > 0) {
      // Já tem reserva: pré-seleciona o modo que bate com o alvo salvo.
      const mesesAprox = Math.round(Number(reservaMeta.valor_alvo) / mediaGastos)
      if ([3, 6, 12].includes(mesesAprox)) {
        setReservaModo("auto")
        setReservaMeses(mesesAprox)
      } else {
        setReservaModo("manual")
        setReservaManual(String(reservaMeta.valor_alvo))
      }
    }
    setModalReserva(true)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2">
        <KpiStat label="Total investido" value={formatarMoeda(total)} deltaColor="accent" />
        <KpiStat label="Renda fixa" value={formatarMoeda(porGrupo["Renda Fixa"])} />
        <KpiStat label="Renda variável" value={formatarMoeda(porGrupo["Renda Variável"])} />
        <KpiStat
          label="Meta de investimento mensal"
          value={formatarMoeda(metaMensalTotal)}
          info="Soma do 'aporte mensal' definido em cada objetivo (aba Metas)."
        />
      </div>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {/* Reserva de emergência: alvo automático (média de gastos) ou manual. */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">🛡️ Reserva de emergência</div>
            <button onClick={abrirModalReserva} className="text-accent text-[12px] hover:underline">
              {reservaMeta ? "Editar" : "Configurar"}
            </button>
          </div>
          {reservaMeta?.valor_alvo ? (
            <>
              <div className="font-mono text-[17px] text-text">{formatarMoeda(reservaMeta.valor_alvo)}</div>
              <div className="text-text-faint text-[11.5px] mb-2">
                meta de reserva · {formatarMoeda(reservaMeta.valor_investido_alocado || 0)} já reservado
              </div>
              <BarRow
                pct={Math.min(100, Math.round(((reservaMeta.valor_investido_alocado || 0) / Number(reservaMeta.valor_alvo)) * 100))}
                value={`${Math.min(100, Math.round(((reservaMeta.valor_investido_alocado || 0) / Number(reservaMeta.valor_alvo)) * 100))}%`}
                labelWidth="w-0"
              />
            </>
          ) : (
            <p className="text-text-faint text-[12px]">
              Defina quanto você quer ter guardado para imprevistos — calculo pela média dos seus gastos ou você informa o valor.
            </p>
          )}
        </Card>

        {/* Distribuição da meta mensal de investimentos entre 3 baldes. */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">📊 Distribuir meta mensal</div>
            <button onClick={() => setModalPlano(true)} disabled={metaMensalTotal <= 0} className="text-accent text-[12px] hover:underline disabled:opacity-40">
              Distribuir
            </button>
          </div>
          {metaMensalTotal > 0 ? (
            <>
              <div className="font-mono text-[17px] text-text">{formatarMoeda(metaMensalTotal)}</div>
              <div className="text-text-faint text-[11.5px] mb-2">meta mensal de investimentos</div>
              {planoDistribuido > 0 ? (
                <div className="flex flex-col gap-1 text-[11.5px]">
                  <div className="flex justify-between"><span className="text-text-dim">Reserva de emergência</span><span className="font-mono">{formatarMoeda(plano.reserva || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-text-dim">Projetos de vida</span><span className="font-mono">{formatarMoeda(plano.projetos || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-text-dim">Independência financeira</span><span className="font-mono">{formatarMoeda(plano.independencia || 0)}</span></div>
                </div>
              ) : (
                <p className="text-text-faint text-[12px]">Ainda não distribuída. Divida entre reserva, projetos e independência.</p>
              )}
            </>
          ) : (
            <p className="text-text-faint text-[12px]">
              Defina um aporte mensal nos seus projetos (aba Projetos) pra ter uma meta mensal a distribuir.
            </p>
          )}
        </Card>
      </div>

      {aportesLancamentos.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
              Aportes vindos dos lançamentos
            </div>
            <div className="text-right">
              <div className="text-[11px] text-text-faint">Total aportado</div>
              <div className="font-mono text-accent text-[15px]">{formatarMoeda(totalAportado)}</div>
            </div>
          </div>
          <p className="text-text-faint text-[11.5px] mb-3">
            Lançamentos que você classificou como investimento. Eles saem do fluxo de
            despesas e entram aqui. Cadastre-os acima como ativo para acompanhar rentabilidade.
          </p>
          <Table>
            <Thead>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Valor</Th>
            </Thead>
            <tbody>
              {aportesLancamentos.map((t) => (
                <Tr key={t.id}>
                  <Td className="text-text-dim whitespace-nowrap">{formatarData(t.data)}</Td>
                  <Td>{t.descricao}</Td>
                  <Td className="text-text-dim">{nomePorCategoria[t.categoria_id] || "—"}</Td>
                  <Td className="text-right font-mono text-accent">
                    {formatarMoeda(Math.abs(Number(t.valor || 0)))}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            {editandoId ? "Editar investimento" : "Novo investimento"}
          </div>
          {!mostrarForm && (
            <Button onClick={() => setMostrarForm(true)}>+ Novo investimento</Button>
          )}
        </div>
        {mostrarForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (form.nome_ativo.trim()) salvar.mutate()
            }}
          >
            <div className="flex gap-3 flex-wrap items-start">
              <div className="w-44">
                <Select
                  label="Tipo"
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, classe_ativo: "" }))}
                >
                  {Object.entries(TIPOS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-44">
                {(CLASSIFICACAO_POR_TIPO[form.tipo] || []).length > 0 ? (
                  <Select
                    label="Classificação"
                    value={form.classe_ativo}
                    onChange={(e) => setForm((f) => ({ ...f, classe_ativo: e.target.value }))}
                  >
                    <option value="">Selecione…</option>
                    {form.classe_ativo && !CLASSIFICACAO_POR_TIPO[form.tipo].includes(form.classe_ativo) && (
                      <option value={form.classe_ativo}>{form.classe_ativo}</option>
                    )}
                    {CLASSIFICACAO_POR_TIPO[form.tipo].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Field
                    label="Classificação"
                    value={form.classe_ativo}
                    onChange={(e) => setForm((f) => ({ ...f, classe_ativo: e.target.value }))}
                    placeholder="ex: livre"
                  />
                )}
              </div>
              <div className="flex-1 min-w-[160px]">
                <Field
                  label="Ativo"
                  value={form.nome_ativo}
                  onChange={(e) => setForm((f) => ({ ...f, nome_ativo: e.target.value }))}
                  placeholder="ex: Tesouro Selic 2029"
                />
              </div>
              <div className="w-44">
                {instituicoesCadastradas.length > 0 ? (
                  <>
                    <Select
                      label="Instituição"
                      value={form.instituicao_nome}
                      onChange={(e) => setForm((f) => ({ ...f, instituicao_nome: e.target.value }))}
                    >
                      <option value="">Escolha…</option>
                      {form.instituicao_nome && !instituicoesCadastradas.includes(form.instituicao_nome) && (
                        <option value={form.instituicao_nome}>{form.instituicao_nome}</option>
                      )}
                      {instituicoesCadastradas.map((inst) => (
                        <option key={inst} value={inst}>
                          {inst}
                        </option>
                      ))}
                    </Select>
                    <p className="text-text-faint text-[10.5px] -mt-2">puxadas das suas contas</p>
                  </>
                ) : (
                  <Field
                    label="Instituição"
                    value={form.instituicao_nome}
                    onChange={(e) => setForm((f) => ({ ...f, instituicao_nome: e.target.value }))}
                    placeholder="ex: XP, Nubank"
                  />
                )}
              </div>
              <div className="w-64">
                <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1.5">Tipo de resgate</div>
                <div className="flex gap-1.5 mb-2">
                  {[
                    ["liquidez", "Liquidez"],
                    ["vencimento", "Data de vencimento"],
                  ].map(([m, rotulo]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setResgateModo(m)}
                      className={`flex-1 px-3 py-2 rounded-[9px] text-[12px] border transition-colors ${
                        resgateModo === m
                          ? "bg-accent/15 border-accent/60 text-accent"
                          : "bg-bg border-line text-text-dim hover:border-text-faint"
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                {resgateModo === "liquidez" ? (
                  <Select value={form.liquidez} onChange={(e) => setForm((f) => ({ ...f, liquidez: e.target.value }))}>
                    <option value="">Selecione a liquidez…</option>
                    {LIQUIDEZ_OPCOES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Field
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
                  />
                )}
              </div>
              <div className="w-36">
                <Field
                  label="Valor aplicado (R$)"
                  type="number"
                  value={form.valor_aplicado}
                  onChange={(e) => setForm((f) => ({ ...f, valor_aplicado: e.target.value }))}
                />
              </div>
              <div className="w-36">
                <Field
                  label="Valor atual (R$)"
                  type="number"
                  value={form.valor_atual}
                  onChange={(e) => setForm((f) => ({ ...f, valor_atual: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
                  Alocar em objetivos (opcional)
                </span>
                <button type="button" onClick={adicionarLinhaAlocacao} className="text-accent text-[12px] hover:underline">
                  + adicionar objetivo
                </button>
              </div>
              <p className="text-text-faint text-[11px] mb-2">
                Objetivo = um <strong className="text-text-dim">projeto</strong> seu (cadastre na aba Projetos). Aqui você
                diz, <strong className="text-text-dim">manualmente</strong>, quanto deste investimento está reservado pra
                cada projeto — não é automático.
              </p>
              {!metas.length && (
                <p className="text-amber text-[11px] mb-2">
                  Você ainda não tem projetos. Crie um na aba <strong>Projetos</strong> pra poder alocar aqui.
                </p>
              )}
              {alocacoes.length > 0 && (
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="flex-1 text-[10px] text-text-faint uppercase tracking-wide font-mono">Objetivo</span>
                  <span className="w-28 text-[10px] text-text-faint uppercase tracking-wide font-mono">Valor (R$)</span>
                  <span className="w-20 text-[10px] text-text-faint uppercase tracking-wide font-mono">Percentual</span>
                  <span className="w-4" />
                </div>
              )}
              {alocacoes.map((a, i) => {
                const valorNum = Number(a.valor_alocado) || 0
                const pct = valorInvestimentoAtual > 0 ? Math.round((valorNum / valorInvestimentoAtual) * 100) : 0
                return (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <select
                      value={a.meta_id}
                      onChange={(e) => atualizarLinhaAlocacao(i, "meta_id", e.target.value)}
                      className="flex-1 bg-bg border border-line rounded-[9px] px-3 py-2 text-[12.5px] text-text outline-none focus:border-accent/60"
                    >
                      <option value="">Selecione o objetivo…</option>
                      {metas.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.titulo}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={a.valor_alocado}
                      onChange={(e) => atualizarLinhaAlocacao(i, "valor_alocado", e.target.value)}
                      placeholder="R$"
                      className="w-28 bg-bg border border-line rounded-[9px] px-3 py-2 text-[12.5px] text-text outline-none focus:border-accent/60"
                    />
                    <div className="w-20 relative">
                      <input
                        type="number"
                        value={valorInvestimentoAtual > 0 ? pct || "" : ""}
                        onChange={(e) => atualizarPctAlocacao(i, e.target.value)}
                        placeholder="%"
                        disabled={!(valorInvestimentoAtual > 0)}
                        title={valorInvestimentoAtual > 0 ? "" : "Preencha o valor atual do produto pra alocar por %"}
                        className="w-full bg-bg border border-line rounded-[9px] pl-3 pr-6 py-2 text-[12.5px] text-text outline-none focus:border-accent/60 disabled:opacity-40"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-faint text-[11px] pointer-events-none">%</span>
                    </div>
                    <button type="button" onClick={() => removerLinhaAlocacao(i)} className="text-text-faint hover:text-red text-[12px]">
                      ✕
                    </button>
                  </div>
                )
              })}
              {alocacoes.length > 0 && valorInvestimentoAtual > 0 && (
                <div className="rounded-[9px] bg-panel-2 px-3 py-2 mt-1 flex items-center justify-between">
                  <span className="text-[11.5px] text-text-dim">
                    {totalAlocado > valorInvestimentoAtual ? (
                      <span className="text-red">Passou {formatarMoeda(totalAlocado - valorInvestimentoAtual)} do valor do produto</span>
                    ) : totalAlocado >= valorInvestimentoAtual ? (
                      <span className="text-accent">Todo o valor do produto foi alocado</span>
                    ) : (
                      `Ainda falta alocar ${formatarMoeda(valorInvestimentoAtual - totalAlocado)}`
                    )}
                  </span>
                  <span className="font-mono text-[12.5px] text-text">
                    {formatarMoeda(totalAlocado)} · {Math.round((totalAlocado / valorInvestimentoAtual) * 100)}%
                  </span>
                </div>
              )}
              {alocacoes.length > 0 && !(valorInvestimentoAtual > 0) && (
                <p className="text-amber text-[11px]">
                  Preencha o <strong>valor atual</strong> do produto acima pra alocar por percentual.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!form.nome_ativo.trim() || salvar.isPending}>
                {salvar.isPending ? "Salvando…" : editandoId ? "Salvar alterações" : "Adicionar investimento"}
              </Button>
              <Button type="button" variant="ghost" onClick={limparForm}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card>
        <div className="flex gap-3 flex-wrap mb-4">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por ativo…"
            className="flex-1 min-w-[180px] bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/60"
          />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text outline-none focus:border-accent/60"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          {instituicoesDisponiveis.length > 0 && (
            <select
              value={filtroInstituicao}
              onChange={(e) => setFiltroInstituicao(e.target.value)}
              className="bg-bg border border-line rounded-[9px] px-3.5 py-2.5 text-[13px] text-text outline-none focus:border-accent/60"
            >
              <option value="">Todas as instituições</option>
              {instituicoesDisponiveis.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          )}
        </div>

        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && !investimentosFiltrados.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            {investimentos.length ? "Nenhum investimento encontrado com esse filtro." : "Nenhum investimento cadastrado — comece adicionando acima."}
          </p>
        )}
        {!!investimentosFiltrados.length && (
          <Table>
            <Thead>
              <Th>Ativo</Th>
              <Th>Classificação</Th>
              <Th>Tipo</Th>
              <Th>Instituição</Th>
              <Th>Resgate</Th>
              <Th className="text-right">Atual</Th>
              <Th></Th>
            </Thead>
            <tbody>
              {investimentosFiltrados.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <div>{i.nome_ativo}</div>
                    {i.alocacoes.length > 0 && (
                      <div className="text-text-faint text-[10.5px] mt-0.5">
                        {i.alocacoes.map((a) => `${a.meta_titulo}: ${formatarMoeda(a.valor_alocado)}`).join(" · ")}
                      </div>
                    )}
                  </Td>
                  <Td className="text-text-dim">{i.classe_ativo || "—"}</Td>
                  <Td className="text-text-dim">{TIPOS[i.tipo]}</Td>
                  <Td className="text-text-dim">{i.instituicao_nome || "—"}</Td>
                  <Td className="text-text-dim">
                    {i.data_vencimento ? `vence ${formatarData(i.data_vencimento)}` : i.liquidez || "—"}
                  </Td>
                  <Td className="text-right font-mono text-accent">{formatarMoeda(i.valor_atual)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <button onClick={() => editar(i)} className="text-text-faint hover:text-text text-[12px] mr-3">
                      Editar
                    </button>
                    <button onClick={() => excluir.mutate(i.id)} className="text-red text-[12px] hover:underline">
                      Excluir
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {modalReserva && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={() => setModalReserva(false)}>
          <div className="bg-panel border border-line rounded-[14px] w-full max-w-lg my-8 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[16px] font-semibold">Reserva de emergência</h3>
              <button onClick={() => setModalReserva(false)} className="text-text-faint hover:text-text text-[18px]">✕</button>
            </div>
            <p className="text-text-faint text-[12px] mb-3">Escolha como prefere definir sua reserva:</p>
            <div className="flex gap-2 mb-4">
              {[
                ["auto", "Calcular automaticamente"],
                ["manual", "Inserir valor manual"],
              ].map(([m, rotulo]) => (
                <button
                  key={m}
                  onClick={() => setReservaModo(m)}
                  className={`flex-1 px-3 py-2.5 rounded-[9px] border text-[12.5px] transition-colors ${
                    reservaModo === m ? "bg-accent/15 border-accent/60 text-accent" : "bg-bg border-line text-text-dim hover:border-text-faint"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {reservaModo === "auto" ? (
              mediaGastos > 0 ? (
                <div>
                  <div className="w-40 mb-3">
                    <Select label="Meses de gasto cobertos" value={reservaMeses} onChange={(e) => setReservaMeses(Number(e.target.value))}>
                      {[3, 6, 12].map((n) => (
                        <option key={n} value={n}>{n} meses</option>
                      ))}
                    </Select>
                  </div>
                  <p className="text-text-dim text-[12px]">
                    Média de gastos: <strong className="text-text">{formatarMoeda(mediaGastos)}</strong>/mês ·
                    reserva sugerida: <strong className="text-accent">{formatarMoeda(reservaAlvo)}</strong>
                  </p>
                </div>
              ) : (
                <p className="text-amber text-[12px]">
                  Você precisa ter lançamentos/orçamento pra calcular a reserva pela média de gastos. Use o valor manual por enquanto.
                </p>
              )
            ) : (
              <div className="w-48">
                <Field label="Valor da reserva (R$)" type="number" value={reservaManual} onChange={(e) => setReservaManual(e.target.value)} />
              </div>
            )}
            <div className="flex justify-end mt-5">
              <Button onClick={() => salvarReserva.mutate()} disabled={salvarReserva.isPending || reservaAlvo <= 0}>
                {salvarReserva.isPending ? "Salvando…" : "Salvar reserva"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalPlano && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={() => setModalPlano(false)}>
          <div className="bg-panel border border-line rounded-[14px] w-full max-w-lg my-8 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-[16px] font-semibold">Distribuir meta de investimentos</h3>
              <button onClick={() => setModalPlano(false)} className="text-text-faint hover:text-text text-[18px]">✕</button>
            </div>
            <p className="text-text-dim text-[12.5px] mb-4">
              Hoje, sua meta de investimentos mensal é <strong className="text-accent">{formatarMoeda(metaMensalTotal)}</strong>. Divida entre os objetivos:
            </p>
            <div className="flex flex-col gap-3">
              {[
                ["reserva", "Reserva de emergência"],
                ["projetos", "Projetos de vida"],
                ["independencia", "Independência financeira"],
              ].map(([k, rotulo]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-text-dim flex-1">{rotulo}</span>
                  <input
                    type="number"
                    value={plano[k]}
                    onChange={(e) => setPlano((p) => ({ ...p, [k]: e.target.value }))}
                    placeholder="R$ 0"
                    className="w-36 bg-bg border border-line rounded-[9px] px-3 py-2 text-[13px] text-text outline-none focus:border-accent/60"
                  />
                </div>
              ))}
            </div>
            <div className={`mt-4 rounded-[9px] px-4 py-2.5 text-[12px] ${planoFalta > 0 ? "bg-panel-2 text-text-dim" : "bg-accent/15 text-accent"}`}>
              {planoFalta > 0
                ? `Ainda falta definir ${formatarMoeda(planoFalta)} da sua meta mensal.`
                : planoDistribuido > metaMensalTotal
                  ? `Você distribuiu ${formatarMoeda(planoDistribuido - metaMensalTotal)} a mais que a meta.`
                  : "Toda a meta mensal foi distribuída."}
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={() => salvarPlano.mutate()} disabled={salvarPlano.isPending}>
                {salvarPlano.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
