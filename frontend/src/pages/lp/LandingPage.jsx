import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import KpiStat from "../../components/ui/KpiStat"
import BarRow from "../../components/ui/BarRow"
import DonutMultiChart from "../../components/ui/DonutMultiChart"
import Termometro from "../../components/ui/Termometro"
import { catalogoPlanos } from "../../api/assinatura"
import { formatarMoeda } from "../../lib/format"

// Todos os números aqui são FICTÍCIOS (cliente demo "Marina Costa") -- servem
// só pra mostrar como as telas ficam preenchidas de verdade, não são dados
// reais de nenhum cliente.

function Logo({ tamanho = 26 }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="rounded-[7px] bg-gradient-to-br from-accent to-blue relative shrink-0"
        style={{ width: tamanho, height: tamanho }}
      >
        <div className="absolute rounded-[3px] bg-bg" style={{ inset: tamanho * 0.27 }} />
      </div>
      <div className="text-[15px] font-semibold">Fluxo</div>
    </div>
  )
}

function JanelaApp({ titulo, children }) {
  return (
    <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line bg-panel-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-accent/70" />
        <span className="ml-3 text-[11.5px] text-text-faint font-mono">{titulo}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ---------- Telas recriadas com dados fictícios (Marina Costa) ----------

function TelaFluxoCaixa() {
  return (
    <JanelaApp titulo="Fluxo de caixa · painel do cliente">
      <div className="mb-4">
        <Termometro score={82} label="Ótimo" />
        <p className="text-center text-accent text-[12.5px] mt-1">
          ✅ Parabéns! Você está economizando 67,7% da sua renda este mês.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiStat label="Receitas · 2026" value="R$ 27.800,00" deltaColor="accent" />
        <KpiStat label="Despesas" value="R$ 8.968,00" deltaColor="red" />
        <KpiStat label="Resultado" value="R$ 18.832,00" deltaColor="accent" />
      </div>
      <Card>
        <div className="text-[10.5px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Receitas × despesas por mês
        </div>
        <div className="flex items-end gap-2 h-24">
          {[
            { m: "jun", r: 0, d: 0 },
            { m: "jul", r: 100, d: 28 },
            { m: "ago", r: 82, d: 31 },
            { m: "set", r: 0, d: 0 },
          ].map((b) => (
            <div key={b.m} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <div className="flex items-end gap-0.5 w-full justify-center h-full">
                <div className="w-1/2 max-w-[14px] rounded-t-[3px] bg-accent" style={{ height: `${b.r}%` }} />
                <div className="w-1/2 max-w-[14px] rounded-t-[3px] bg-red" style={{ height: `${b.d}%` }} />
              </div>
              <span className="text-[10px] font-mono text-text-faint">{b.m}</span>
            </div>
          ))}
        </div>
      </Card>
    </JanelaApp>
  )
}

function TelaPlanejamento() {
  return (
    <JanelaApp titulo="Planejamento · painel do cliente">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiStat label="Renda do mês" value="R$ 12.500,00" deltaColor="accent" />
        <KpiStat label="Gastos planejados" value="R$ 5.500,00" deltaColor="red" />
        <KpiStat label="Sobra no plano" value="R$ 7.000,00" deltaColor="accent" />
      </div>
      <Card className="mb-3">
        <div className="text-[10.5px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Composição do mês · Agosto/2026
        </div>
        <div className="flex items-end gap-8 justify-center py-1">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-14 rounded-t-[5px] bg-accent" style={{ height: 130 }} />
            <span className="text-[11px] text-text-dim">Renda</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-14 rounded-t-[5px] overflow-hidden flex flex-col-reverse" style={{ height: 57 }}>
              <div style={{ height: "27%", background: "#4C8DFF" }} />
              <div style={{ height: "73%", background: "#26D9A8" }} />
            </div>
            <span className="text-[11px] text-text-dim">Gastos planejados</span>
          </div>
        </div>
      </Card>
      <div className="bg-panel-2 rounded-[9px] px-4 py-2.5 text-[12px] text-text-dim">
        Cumprindo as metas, você economiza <strong className="text-accent">R$ 7.000,00</strong> todos os meses —{" "}
        <strong className="text-accent">R$ 84.000,00</strong> no ano.
      </div>
    </JanelaApp>
  )
}

function TelaMetas() {
  const metas = [
    { titulo: "Reserva de emergência", sub: "essencial · curto prazo", pct: 90, valor: "R$ 45.000,00" },
    { titulo: "Viagem Europa", sub: "desejo · médio prazo", pct: 57, valor: "R$ 8.500,00" },
    { titulo: "Aposentadoria antecipada", sub: "sonho · longo prazo", pct: 12, valor: "R$ 180.000,00" },
  ]
  return (
    <JanelaApp titulo="Metas · painel do cliente">
      <div className="flex flex-col gap-3">
        {metas.map((m) => (
          <Card key={m.titulo}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-[13px]">{m.titulo}</span>
              <span className="text-text-faint text-[10.5px] font-mono">{m.sub}</span>
            </div>
            <BarRow label={m.valor} pct={m.pct} value={`${m.pct}%`} labelWidth="w-[100px]" />
          </Card>
        ))}
      </div>
    </JanelaApp>
  )
}

function TelaInvestimentos() {
  const ativos = [
    { nome: "Tesouro IPCA+ 2035", tipo: "Renda fixa", inst: "XP Investimentos", valor: "R$ 50.000,00" },
    { nome: "Ações BOVA11", tipo: "Ação", inst: "XP Investimentos", valor: "R$ 25.000,00" },
    { nome: "Fundo Multimercado", tipo: "Fundo", inst: "Itaú", valor: "R$ 10.000,00" },
  ]
  return (
    <JanelaApp titulo="Investimentos · painel do cliente">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiStat label="Total investido" value="R$ 85.000,00" deltaColor="accent" />
        <KpiStat label="Renda fixa" value="R$ 50.000,00" />
        <KpiStat label="Renda variável" value="R$ 35.000,00" />
      </div>
      <Card>
        <div className="flex flex-col gap-2.5">
          {ativos.map((a) => (
            <div key={a.nome} className="flex items-center justify-between text-[12.5px] border-b border-line last:border-0 pb-2.5 last:pb-0">
              <div>
                <div className="font-medium text-text">{a.nome}</div>
                <div className="text-text-faint text-[11px]">
                  {a.tipo} · {a.inst}
                </div>
              </div>
              <span className="font-mono text-accent">{a.valor}</span>
            </div>
          ))}
        </div>
      </Card>
    </JanelaApp>
  )
}

function TelaPatrimonio() {
  return (
    <JanelaApp titulo="Patrimônio · painel do cliente">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiStat label="Patrimônio líquido" value="R$ 238.832,00" deltaColor="accent" />
        <KpiStat label="Total de ativos" value="R$ 238.832,00" />
        <KpiStat label="Total de passivos" value="R$ 0,00" />
      </div>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10.5px] text-text-faint uppercase tracking-wide font-mono">Resumo patrimonial</div>
          <span className="text-accent text-[11px] font-mono">35,6% em ativos geradores de renda</span>
        </div>
        <DonutMultiChart
          size={120}
          fatias={[
            { label: "Investimentos", valor: 85000, cor: "#26D9A8" },
            { label: "Saldo em conta", valor: 18832.9, cor: "#4C8DFF" },
            { label: "Bens móveis/imóveis", valor: 135000, cor: "#F0A63C" },
          ]}
        />
      </Card>
    </JanelaApp>
  )
}

function TelaLancamentos() {
  const itens = [
    { d: "21/08", desc: "Presente aniversário", cat: "Despesas não obrigatórias", icone: "🎁", v: "- R$ 250,00" },
    { d: "16/08", desc: "Cinema + jantar", cat: "Despesas não obrigatórias", icone: "🎬", v: "- R$ 210,00" },
    { d: "15/08", desc: "Notebook Dell (1/10)", cat: "Despesas não obrigatórias", icone: "🛍️", v: "- R$ 480,00" },
    { d: "11/08", desc: "Plano de saúde", cat: "Despesas obrigatórias", icone: "🏠", v: "- R$ 620,00" },
  ]
  return (
    <JanelaApp titulo="Lançamentos · categorizados automaticamente por IA">
      <div className="flex items-center gap-4 flex-wrap text-[11.5px] mb-3 text-text-faint">
        <span>18 lançamentos</span>
        <span className="font-mono text-accent">Entradas: R$ 27.800,00</span>
        <span className="font-mono text-red">Saídas: R$ 8.968,00</span>
      </div>
      <Card>
        <div className="flex flex-col gap-2.5">
          {itens.map((t) => (
            <div key={t.desc} className="flex items-center justify-between text-[12.5px] border-b border-line last:border-0 pb-2.5 last:pb-0">
              <div className="flex items-center gap-2.5">
                <span className="text-text-faint font-mono text-[11px] w-9">{t.d}</span>
                <span>{t.icone}</span>
                <div>
                  <div className="text-text">{t.desc}</div>
                  <div className="text-text-faint text-[10.5px]">{t.cat}</div>
                </div>
              </div>
              <span className="font-mono text-red">{t.v}</span>
            </div>
          ))}
        </div>
      </Card>
    </JanelaApp>
  )
}

function TelaCrm() {
  return (
    <JanelaApp titulo="CRM · painel do planejador">
      <Card className="mb-3">
        <div className="text-[10.5px] text-text-faint uppercase tracking-wide font-mono mb-2">Cliente selecionado</div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[12px] font-semibold">
            MC
          </div>
          <div>
            <div className="font-medium text-[13px]">Marina Costa</div>
            <div className="text-text-faint text-[11px]">Disciplinado · Aposentadoria antecipada</div>
          </div>
        </div>
      </Card>
      <Card>
        <div className="text-[10.5px] text-text-faint uppercase tracking-wide font-mono mb-2.5">Tarefas pro cliente</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="w-4 h-4 rounded border border-line shrink-0" />
            <span className="text-text-dim">Aportar R$ 1.500 na reserva de emergência</span>
          </div>
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="w-4 h-4 rounded bg-accent/20 text-accent flex items-center justify-center text-[10px] shrink-0">✓</span>
            <span className="text-text-faint line-through">Revisar orçamento de despesas não obrigatórias</span>
            <Pill variant="on">concluída</Pill>
          </div>
        </div>
      </Card>
    </JanelaApp>
  )
}

const TELAS_CARROSSEL = [
  { key: "fluxo", label: "Fluxo de caixa", render: TelaFluxoCaixa },
  { key: "planejamento", label: "Planejamento", render: TelaPlanejamento },
  { key: "metas", label: "Metas", render: TelaMetas },
  { key: "investimentos", label: "Investimentos", render: TelaInvestimentos },
  { key: "patrimonio", label: "Patrimônio", render: TelaPatrimonio },
  { key: "lancamentos", label: "Lançamentos", render: TelaLancamentos },
  { key: "crm", label: "CRM do planejador", render: TelaCrm },
]

function CarrosselTelas() {
  const [ativo, setAtivo] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setAtivo((i) => (i + 1) % TELAS_CARROSSEL.length), 4500)
    return () => clearInterval(id)
  }, [])

  const Tela = TELAS_CARROSSEL[ativo].render

  return (
    <div>
      <Tela />
      <div className="flex items-center justify-center gap-2 mt-5">
        {TELAS_CARROSSEL.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setAtivo(i)}
            title={t.label}
            className={`h-1.5 rounded-full transition-all ${
              i === ativo ? "w-6 bg-accent" : "w-1.5 bg-line hover:bg-text-faint"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// Destaques -- os diferenciais mais fortes, com mais detalhe que o grid.
const DESTAQUES = [
  {
    icone: "📄",
    titulo: "Importe qualquer extrato, de qualquer arquivo",
    texto:
      "Fatura de cartão ou extrato de conta, em PDF (mesmo protegido por senha), OFX ou CSV — de qualquer banco. Não precisa ter o cartão cadastrado nem conexão com o banco: sobe o arquivo e os lançamentos entram na hora.",
  },
  {
    icone: "🤖",
    titulo: "Lançamento automático com IA",
    texto:
      "Ao subir uma fatura, cada compra já chega classificada por IA e as parcelas futuras são geradas como projeção nos próximos meses — sem duplicar quando a próxima fatura chega. Você só ajusta o que quiser.",
  },
  {
    icone: "🔄",
    titulo: "Virada do cartão (opcional)",
    texto:
      "Configure a data de fechamento do cartão pra que cada compra conte no mês em que será paga, não no mês em que foi feita — mapeando o gasto real do mês. É opcional e editável: a data da compra continua visível, só muda em qual mês ela é somada.",
  },
]

const RECURSOS = [
  { icone: "🔎", titulo: "Filtros e ações em massa", texto: "Filtre por conta, cartão, categoria, subcategoria ou período; importe ou exclua lançamentos em massa." },
  { icone: "💸", titulo: "Fluxo de caixa", texto: "Receitas, despesas e resultado por mês, com gráfico e exportação em PDF/Excel." },
  { icone: "📊", titulo: "Resumo financeiro", texto: "Visão anual mês a mês — clique num valor e veja os lançamentos por trás dele." },
  { icone: "🎯", titulo: "Planejamento e metas", texto: "Metas de gasto por categoria, priorização (essencial/desejo/sonho) e acompanhamento de aportes." },
  { icone: "🧓", titulo: "Meu Futuro (FIRE)", texto: "Simulador de independência financeira: quanto investir por mês pra aposentar na idade que quiser." },
  { icone: "📈", titulo: "Investimentos", texto: "Carteira por instituição e liquidez, com alocação direta pra cada meta do cliente." },
  { icone: "🏦", titulo: "Patrimônio", texto: "Ativos, dívidas, bens móveis e imóveis — patrimônio líquido sempre atualizado." },
  { icone: "🛡️", titulo: "Proteção", texto: "Cobertura de seguro de vida atual vs. recomendada, com apólices cadastradas." },
  { icone: "💳", titulo: "Contas e cartões", texto: "Saldo atualizado automaticamente pelos lançamentos, com virada de fatura configurável." },
  { icone: "🏷️", titulo: "Categorias sob medida", texto: "Categorias padrão prontas, mais as que você e cada cliente quiserem criar." },
  { icone: "🤝", titulo: "CRM com Google Agenda", texto: "Timeline de cada cliente, follow-ups sincronizados com o Google Agenda e checklist de tarefas." },
  { icone: "🎨", titulo: "Sua marca (white label)", texto: "Subdomínio, cor e logo próprios — seu cliente vê o painel com a cara do seu escritório." },
]

const BENEFICIOS_PLANO = {
  essencial: ["Upload manual de extrato/fatura (OFX, CSV, PDF)", "Classificação automática por IA", "Até 4 clientes inclusos"],
  completo: ["Tudo do Essencial", "Conciliação via Open Finance", "Marca própria (subdomínio, cor, logo)", "Até 4 clientes inclusos"],
}

const FAQ = [
  { p: "Preciso instalar alguma coisa?", r: "Não — é 100% web. Você e seus clientes acessam pelo navegador, no computador ou celular." },
  { p: "De quais bancos consigo importar?", r: "De qualquer um. A leitura é feita a partir do arquivo (PDF, OFX ou CSV) que você já baixa do internet banking ou do app do cartão — não depende de integração com o banco, então funciona com fatura ou extrato de qualquer instituição." },
  { p: "Preciso cadastrar o cartão antes de importar?", r: "Não. Você pode subir qualquer fatura ou extrato sem ter o cartão/conta cadastrados. Se quiser, depois vincula a importação a um cartão específico pra acompanhar limite e virada de fatura." },
  { p: "Os planos incluem quantos clientes?", r: "Os dois planos incluem 4 clientes. A partir do 5º, cada cliente extra tem um valor fixo mensal adicional." },
  { p: "Posso cancelar quando quiser?", r: "Sim, a assinatura é mensal recorrente e sem fidelidade." },
  { p: "Meus clientes têm acesso próprio?", r: "Sim — cada cliente recebe um login exclusivo pra acompanhar o próprio painel financeiro, separado do seu." },
  { p: "E o Open Finance?", r: "Disponível no Plano Completo. Hoje a importação é por arquivo (PDF/OFX/CSV); a conexão automática com bancos está em ativação." },
]

export default function LandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem("fluxo_token")) navigate("/inicio", { replace: true })
  }, [navigate])

  const { data: planos } = useQuery({ queryKey: ["lp-planos"], queryFn: catalogoPlanos })

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-text-dim">
            <a href="#recursos" className="hover:text-text">Recursos</a>
            <a href="#planos" className="hover:text-text">Planos</a>
            <a href="#faq" className="hover:text-text">Perguntas frequentes</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-[13px] text-text-dim hover:text-text hidden sm:block">
              Entrar
            </Link>
            <Link to="/cadastro">
              <Button className="!px-4 !py-2.5 !text-[12.5px]">Comece grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1180px] mx-auto px-6 pt-16 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <Pill variant="on">Para planejadores financeiros</Pill>
          <h1 className="font-display text-[34px] md:text-[42px] font-bold leading-tight mt-4 mb-5">
            O painel financeiro que seus clientes vão querer abrir todo dia
          </h1>
          <p className="text-text-dim text-[15px] leading-relaxed mb-7">
            Fluxo de caixa, metas, investimentos, patrimônio, proteção e um CRM completo pra você acompanhar cada
            cliente — tudo com a sua marca, num só lugar.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link to="/cadastro">
              <Button>Comece grátis por 7 dias →</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">Já tenho conta</Button>
            </Link>
          </div>
          <p className="text-text-faint text-[11.5px] mt-4">Sem cartão de crédito pra testar. Cancele quando quiser.</p>
        </div>
        <div>
          <CarrosselTelas />
          <p className="text-text-faint text-[11px] text-center mt-3">
            * Telas com dados fictícios (cliente demonstrativo), só pra ilustrar o produto.
          </p>
        </div>
      </section>

      {/* Destaques */}
      <section className="max-w-[1180px] mx-auto px-6 py-10">
        <div className="text-center mb-10">
          <div className="text-accent text-[11px] uppercase tracking-wide font-mono mb-2">O que faz diferença</div>
          <h2 className="font-display text-[28px] font-bold">Menos trabalho manual, mais planejamento</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {DESTAQUES.map((d) => (
            <Card key={d.titulo} className="p-6">
              <div className="text-[26px] mb-3">{d.icone}</div>
              <div className="font-display font-semibold text-[16px] mb-2">{d.titulo}</div>
              <p className="text-text-dim text-[13px] leading-relaxed">{d.texto}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="max-w-[1180px] mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="text-accent text-[11px] uppercase tracking-wide font-mono mb-2">Tudo incluso</div>
          <h2 className="font-display text-[28px] font-bold">Um painel completo pra cada cliente</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {RECURSOS.map((r) => (
            <Card key={r.titulo}>
              <div className="text-[22px] mb-2.5">{r.icone}</div>
              <div className="font-semibold text-[14px] mb-1.5">{r.titulo}</div>
              <p className="text-text-dim text-[12.5px] leading-relaxed">{r.texto}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="max-w-[1180px] mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="text-accent text-[11px] uppercase tracking-wide font-mono mb-2">Planos</div>
          <h2 className="font-display text-[28px] font-bold mb-2">Simples, sem pegadinha</h2>
          <p className="text-text-dim text-[14px]">Comece com 7 dias grátis. Cancele quando quiser.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
          {(planos || []).map((p) => (
            <Card key={p.tipo_plano} accent={p.tipo_plano === "completo"} className="flex flex-col">
              {p.tipo_plano === "completo" && (
                <div className="mb-2">
                  <Pill variant="on">Mais popular</Pill>
                </div>
              )}
              <div className="font-display font-semibold text-lg mb-1">{p.nome}</div>
              <div className="text-accent font-mono text-2xl mb-4">
                {formatarMoeda(p.valor_base)}
                <span className="text-text-faint text-[13px] font-sans"> /mês</span>
              </div>
              <ul className="space-y-2 text-[13px] text-text-dim mb-5 flex-1">
                {BENEFICIOS_PLANO[p.tipo_plano]?.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-accent shrink-0">✓</span> {b}
                  </li>
                ))}
              </ul>
              <div className="text-text-faint text-[11.5px] mb-4">
                Cliente extra (5º+): {formatarMoeda(p.valor_por_extra)}/mês
              </div>
              <Link to="/cadastro">
                <Button variant={p.tipo_plano === "completo" ? "primary" : "ghost"} block>
                  Começar agora
                </Button>
              </Link>
            </Card>
          ))}
          {!planos && (
            <>
              <Card className="h-64 animate-pulse" />
              <Card className="h-64 animate-pulse" />
            </>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-[820px] mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <div className="text-accent text-[11px] uppercase tracking-wide font-mono mb-2">Dúvidas</div>
          <h2 className="font-display text-[28px] font-bold">Perguntas frequentes</h2>
        </div>
        <div className="flex flex-col gap-3">
          {FAQ.map((f) => (
            <Card key={f.p}>
              <div className="font-medium text-[14px] mb-1.5">{f.p}</div>
              <p className="text-text-dim text-[13px] leading-relaxed">{f.r}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-[1180px] mx-auto px-6 pb-20">
        <Card className="text-center py-14 px-6" accent>
          <h2 className="font-display text-[26px] font-bold mb-3">Pronto pra dar esse painel aos seus clientes?</h2>
          <p className="text-text-dim text-[14px] mb-6">Teste grátis por 7 dias — sem cartão de crédito.</p>
          <Link to="/cadastro">
            <Button>Comece grátis →</Button>
          </Link>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
          <Logo tamanho={20} />
          <div className="flex items-center gap-5 text-text-faint text-[12px]">
            <a href="#recursos" className="hover:text-text-dim">Recursos</a>
            <a href="#planos" className="hover:text-text-dim">Planos</a>
            <Link to="/login" className="hover:text-text-dim">Entrar</Link>
          </div>
          <div className="text-text-faint text-[11.5px]">© {new Date().getFullYear()} Fluxo · Planejamento Financeiro</div>
        </div>
      </footer>
    </div>
  )
}
