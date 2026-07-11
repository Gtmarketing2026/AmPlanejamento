import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import BarRow from "../../../components/ui/BarRow"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import {
  atualizarMinhaApolice,
  criarMinhaApolice,
  excluirMinhaApolice,
  obterMinhaProtecao,
  obterProtecaoConfig,
  obterProtecaoMedias,
  salvarProtecaoConfig,
} from "../../../api/patrimonio"
import { meuPerfilCliente } from "../../../api/clientes"
import { formatarData, formatarMoeda } from "../../../lib/format"

const APOLICE_VAZIA = {
  titular: "",
  tipo: "vida",
  seguradora: "",
  valor_cobertura: "",
  premio_mensal: "",
  vigencia_inicio: "",
  vencimento: "",
}

// --- Calculadora de seguro de vida ideal ---
const CONFIG_PADRAO = {
  dependentes: [],
  padrao_vida: {
    renda_mensal: "",
    categorias: {
      obrigatorias: { valor: "", ativo: false },
      empresa: { valor: "", ativo: false },
      nao_obrigatorias: { valor: "", ativo: false },
      projetos: { valor: "", ativo: false },
    },
    periodo_anos: "",
  },
  sucessao: { despesas_especificas: "", honorarios_pct: 4, itcmd_pct: 0 },
}
const CAT_LABEL = {
  obrigatorias: "Despesas obrigatórias",
  empresa: "Empresa e autônomo",
  nao_obrigatorias: "Despesas não obrigatórias",
  projetos: "Projetos",
}
const num = (v) => {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}
const calcEducacao = (cfg) =>
  (cfg.dependentes || []).reduce((s, d) => (d.ativo === false ? s : s + num(d.anos) * 12 * num(d.auxilio_mensal)), 0)
const calcPadrao = (cfg) => {
  const pv = cfg.padrao_vida || {}
  const mensal = Object.values(pv.categorias || {}).reduce((s, c) => (c?.ativo ? s + num(c.valor) : s), 0)
  return mensal * 12 * num(pv.periodo_anos)
}
const calcSucessao = (cfg, pl) => {
  const s = cfg.sucessao || {}
  return num(s.despesas_especificas) + ((num(s.honorarios_pct) + num(s.itcmd_pct)) / 100) * num(pl)
}

// Card resumo de uma das 3 necessidades, com botão "Configurar cobertura".
function CardNecessidade({ titulo, icone, valor, onConfig }) {
  return (
    <div className="rounded-[11px] border border-line bg-panel-2 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[18px]">{icone}</span>
        <span className="text-[13px] font-semibold text-text">{titulo}</span>
      </div>
      <div className="font-mono text-[17px] text-text mb-0.5">{formatarMoeda(valor)}</div>
      <div className="text-text-faint text-[11px] mb-3">cobertura ideal</div>
      <button onClick={onConfig} className="mt-auto text-accent text-[12.5px] hover:underline text-left">
        Configurar cobertura →
      </button>
    </div>
  )
}

// Modal genérico das configs de proteção (overlay + card centralizado).
function ModalProtecao({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onFechar}>
      <div
        className="bg-panel border border-line rounded-[14px] w-full max-w-2xl my-8 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-[16px] font-semibold">{titulo}</h3>
          <button onClick={onFechar} className="text-text-faint hover:text-text text-[18px] leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const TIPOS = {
  vida: "Seguro de vida",
  saude: "Plano de saúde",
  patrimonial: "Seguro patrimonial",
  outro: "Outro",
}

export default function ProtecaoTab({ token }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(APOLICE_VAZIA)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null) // null = criando; id = editando

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-protecao", token],
    queryFn: () => obterMinhaProtecao(token),
    enabled: !!token,
  })
  const { data: perfil } = useQuery({
    queryKey: ["cliente-eu", token],
    queryFn: () => meuPerfilCliente(token),
    enabled: !!token,
  })
  // Opções de titular da apólice: o próprio cliente e, se cadastrado, o cônjuge.
  const titulares = [perfil?.nome, perfil?.conjuge_nome].filter(Boolean)

  // Payload compartilhado por criar e editar (mesmos campos do form).
  const payloadApolice = () => ({
    titular: form.titular || null,
    tipo: form.tipo,
    seguradora: form.seguradora,
    valor_cobertura: Number(form.valor_cobertura),
    premio_mensal: form.premio_mensal ? Number(form.premio_mensal) : null,
    vigencia_inicio: form.vigencia_inicio || null,
    vencimento: form.vencimento || null,
  })
  const fecharForm = () => {
    qc.invalidateQueries({ queryKey: ["cliente-eu-protecao", token] })
    setForm(APOLICE_VAZIA)
    setEditandoId(null)
    setMostrarForm(false)
  }

  const criar = useMutation({
    mutationFn: () => criarMinhaApolice(token, payloadApolice()),
    onSuccess: fecharForm,
  })
  const atualizar = useMutation({
    mutationFn: () => atualizarMinhaApolice(token, editandoId, payloadApolice()),
    onSuccess: fecharForm,
  })
  const salvandoApolice = criar.isPending || atualizar.isPending

  // Abre o form já preenchido com a apólice escolhida (modo edição).
  const editarApolice = (a) => {
    setForm({
      titular: a.titular || "",
      tipo: a.tipo || "vida",
      seguradora: a.seguradora || "",
      valor_cobertura: a.valor_cobertura ?? "",
      premio_mensal: a.premio_mensal ?? "",
      vigencia_inicio: a.vigencia_inicio || "",
      vencimento: a.vencimento || "",
    })
    setEditandoId(a.id)
    setMostrarForm(true)
  }
  const salvarApolice = () => {
    if (!form.seguradora.trim() || !form.valor_cobertura) return
    ;(editandoId ? atualizar : criar).mutate()
  }

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaApolice(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-protecao", token] }),
  })

  // --- Calculadora de seguro de vida ideal (config + médias) ---
  const { data: configResp } = useQuery({
    queryKey: ["cliente-eu-protecao-config", token],
    queryFn: () => obterProtecaoConfig(token),
    enabled: !!token,
  })
  const { data: medias } = useQuery({
    queryKey: ["cliente-eu-protecao-medias", token],
    queryFn: () => obterProtecaoMedias(token),
    enabled: !!token,
  })
  const [modalAberto, setModalAberto] = useState(null) // educacao | padrao | sucessao
  const [cfg, setCfg] = useState(CONFIG_PADRAO)
  useEffect(() => {
    if (configResp?.config && Object.keys(configResp.config).length) {
      setCfg({ ...CONFIG_PADRAO, ...configResp.config })
    }
  }, [configResp])
  const salvarConfig = useMutation({
    mutationFn: (novo) => salvarProtecaoConfig(token, novo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-protecao-config", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-protecao", token] })
      setModalAberto(null)
    },
  })
  const pl = medias?.patrimonio_liquido || 0
  const vEducacao = calcEducacao(cfg)
  const vPadrao = calcPadrao(cfg)
  const vSucessao = calcSucessao(cfg, pl)
  const nomeCliente = perfil?.nome?.split(" ")[0] || "titular"
  const responsaveis = ["Ambos", perfil?.nome, perfil?.conjuge_nome].filter(Boolean)

  function preencherAuto() {
    if (!medias) return
    setCfg((c) => ({
      ...c,
      padrao_vida: {
        ...c.padrao_vida,
        renda_mensal: medias.renda_mensal || "",
        categorias: {
          obrigatorias: { ...c.padrao_vida.categorias.obrigatorias, valor: medias.obrigatorias || "" },
          empresa: { ...c.padrao_vida.categorias.empresa, valor: medias.empresa || "" },
          nao_obrigatorias: { ...c.padrao_vida.categorias.nao_obrigatorias, valor: medias.nao_obrigatorias || "" },
          projetos: { ...c.padrao_vida.categorias.projetos, valor: medias.projetos || "" },
        },
      },
    }))
  }

  if (isLoading || !data) return <p className="text-text-faint text-sm">Carregando…</p>

  const pctCoberto = data.cobertura_recomendada > 0 ? Math.round((data.cobertura_atual / data.cobertura_recomendada) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <KpiStat label="Cobertura de vida atual" value={formatarMoeda(data.cobertura_atual)} deltaColor="accent" />
        <KpiStat
          label="Cobertura recomendada"
          value={formatarMoeda(data.cobertura_recomendada)}
          info="Estimativa de referência (múltiplo da sua renda mensal atual) — não substitui uma análise detalhada com seu planejador."
        />
      </div>

      {data.cobertura_recomendada > 0 && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Cobertura de vida — quanto você já tem vs. o recomendado
          </div>
          <BarRow
            label={formatarMoeda(data.cobertura_atual)}
            pct={pctCoberto}
            value={`${pctCoberto}%`}
            labelWidth="w-[110px]"
          />
          {pctCoberto < 100 && (
            <p className="text-text-faint text-[11.5px] mt-2">
              Faltam {formatarMoeda(Math.max(0, data.cobertura_recomendada - data.cobertura_atual))} de cobertura
              pra chegar na referência estimada.
            </p>
          )}
        </Card>
      )}

      {/* Calculadora de seguro de vida ideal: 3 necessidades configuráveis. */}
      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">
          Cobertura ideal de seguro de vida
        </div>
        <p className="text-text-faint text-[11.5px] mb-4">
          Configure as 3 necessidades da família. A soma vira a cobertura recomendada.
        </p>
        <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <CardNecessidade titulo="Educação e dependentes" icone="🎓" valor={vEducacao} onConfig={() => setModalAberto("educacao")} />
          <CardNecessidade titulo="Padrão de vida" icone="💵" valor={vPadrao} onConfig={() => setModalAberto("padrao")} />
          <CardNecessidade titulo="Sucessão patrimonial" icone="🏛️" valor={vSucessao} onConfig={() => setModalAberto("sucessao")} />
        </div>
        <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
          <span className="text-[12.5px] text-text-dim">Cobertura ideal total</span>
          <span className="font-mono text-[15px] text-accent">{formatarMoeda(vEducacao + vPadrao + vSucessao)}</span>
        </div>
      </Card>

      {modalAberto === "educacao" && (
        <ModalProtecao titulo="Configurar educação e dependentes" onFechar={() => setModalAberto(null)}>
          <div className="font-display text-[15px] font-semibold mb-3">
            Ajuste a cobertura ideal para cada um de seus dependentes
          </div>
          <div className="flex flex-col gap-2">
            {(cfg.dependentes || []).map((d, i) => {
              const total = num(d.anos) * 12 * num(d.auxilio_mensal)
              const set = (campo, valor) =>
                setCfg((c) => {
                  const deps = [...c.dependentes]
                  deps[i] = { ...deps[i], [campo]: valor }
                  return { ...c, dependentes: deps }
                })
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_90px_120px_120px_auto_auto] gap-2 items-end max-md:grid-cols-2">
                  <Select label={i === 0 ? "Responsável" : ""} value={d.responsavel || ""} onChange={(e) => set("responsavel", e.target.value)}>
                    <option value="">Selecione…</option>
                    {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  <Field label={i === 0 ? "Nome" : ""} value={d.nome || ""} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: Maria" />
                  <Field label={i === 0 ? "Cobertura (anos)" : ""} type="number" value={d.anos || ""} onChange={(e) => set("anos", e.target.value)} placeholder="7" />
                  <Field label={i === 0 ? "Auxílio mensal (R$)" : ""} type="number" value={d.auxilio_mensal || ""} onChange={(e) => set("auxilio_mensal", e.target.value)} />
                  <div>
                    {i === 0 && <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">Valor total</div>}
                    <div className="h-[42px] flex items-center px-3 rounded-[9px] bg-panel-2 border border-line font-mono text-[13px]">{formatarMoeda(total)}</div>
                  </div>
                  <button
                    onClick={() => set("ativo", d.ativo === false)}
                    title={d.ativo === false ? "Inativo — clique para ativar" : "Ativo"}
                    className={`w-8 h-[18px] rounded-full relative transition-colors mb-3 ${d.ativo === false ? "bg-line" : "bg-accent"}`}
                  >
                    <span className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all ${d.ativo === false ? "left-[2px]" : "left-[17px]"}`} />
                  </button>
                  <button onClick={() => setCfg((c) => ({ ...c, dependentes: c.dependentes.filter((_, j) => j !== i) }))} className="text-text-faint hover:text-red text-[13px] mb-3">✕</button>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => setCfg((c) => ({ ...c, dependentes: [...(c.dependentes || []), { responsavel: "", nome: "", anos: "", auxilio_mensal: "", ativo: true }] }))}
            className="text-accent text-[12.5px] hover:underline mt-3"
          >
            + Adicionar dependente
          </button>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-line">
            <span className="text-[12.5px] text-text-dim">Cobertura necessária</span>
            <span className="font-mono text-accent text-[14px]">{formatarMoeda(vEducacao)}</span>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => salvarConfig.mutate(cfg)} disabled={salvarConfig.isPending}>
              {salvarConfig.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </ModalProtecao>
      )}

      {modalAberto === "padrao" && (
        <ModalProtecao titulo="Configurar padrão de vida" onFechar={() => setModalAberto(null)}>
          <div className="text-[13px] font-semibold mb-1">Renda familiar</div>
          <div className="w-64 mb-4">
            <Field
              label={`Renda mensal ${nomeCliente}`}
              type="number"
              value={cfg.padrao_vida.renda_mensal}
              onChange={(e) => setCfg((c) => ({ ...c, padrao_vida: { ...c.padrao_vida, renda_mensal: e.target.value } }))}
            />
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[13px] font-semibold">Despesas e cobertura</div>
            <button onClick={preencherAuto} disabled={!medias} className="text-accent text-[12.5px] hover:underline disabled:opacity-40">
              ✨ Preencher automaticamente
            </button>
          </div>
          <p className="text-text-faint text-[11px] mb-2">
            Marque as despesas que o seguro deve cobrir. "Preencher automaticamente" traz a média dos últimos {medias?.meses_considerados || 6} meses.
          </p>
          <div className="flex flex-col gap-2">
            {Object.keys(CAT_LABEL).map((k) => {
              const c = cfg.padrao_vida.categorias[k] || { valor: "", ativo: false }
              const set = (campo, valor) =>
                setCfg((s) => ({ ...s, padrao_vida: { ...s.padrao_vida, categorias: { ...s.padrao_vida.categorias, [k]: { ...c, [campo]: valor } } } }))
              return (
                <div key={k} className="flex items-center gap-3">
                  <button
                    onClick={() => set("ativo", !c.ativo)}
                    className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 ${c.ativo ? "bg-accent" : "bg-line"}`}
                  >
                    <span className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all ${c.ativo ? "left-[17px]" : "left-[2px]"}`} />
                  </button>
                  <span className={`flex-1 text-[13px] ${c.ativo ? "text-text" : "text-text-faint"}`}>{CAT_LABEL[k]}</span>
                  <input
                    type="number"
                    value={c.valor}
                    onChange={(e) => set("valor", e.target.value)}
                    placeholder="R$ 0"
                    className="w-36 bg-bg border border-line rounded-[9px] px-3 py-2 text-[13px] text-text outline-none focus:border-accent/60"
                  />
                </div>
              )
            })}
          </div>
          <div className="w-48 mt-4">
            <Select
              label="Período de cobertura"
              value={cfg.padrao_vida.periodo_anos}
              onChange={(e) => setCfg((c) => ({ ...c, padrao_vida: { ...c.padrao_vida, periodo_anos: e.target.value } }))}
            >
              <option value="">Selecione…</option>
              {Array.from({ length: 15 }, (_, i) => i + 1).map((a) => (
                <option key={a} value={a}>{a} {a === 1 ? "ano" : "anos"}</option>
              ))}
            </Select>
          </div>
          <div className="mt-4 rounded-[9px] bg-panel-2 px-4 py-3">
            <div className="text-[12px] font-semibold">Cobertura necessária</div>
            <div className="text-text-faint text-[11px] mb-1">
              Pra garantir o padrão de vida da família por {num(cfg.padrao_vida.periodo_anos) || 0} {num(cfg.padrao_vida.periodo_anos) === 1 ? "ano" : "anos"}.
            </div>
            <div className="font-mono text-accent text-[15px]">{formatarMoeda(vPadrao)}</div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => salvarConfig.mutate(cfg)} disabled={salvarConfig.isPending}>
              {salvarConfig.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </ModalProtecao>
      )}

      {modalAberto === "sucessao" && (
        <ModalProtecao titulo="Configurar sucessão patrimonial" onFechar={() => setModalAberto(null)}>
          <div className="text-[13px] font-semibold mb-3">Inventário</div>
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <Field
              label="Despesas específicas (R$)"
              type="number"
              value={cfg.sucessao.despesas_especificas}
              onChange={(e) => setCfg((c) => ({ ...c, sucessao: { ...c.sucessao, despesas_especificas: e.target.value } }))}
            />
            <Field
              label="Honorários advocatícios (%)"
              type="number"
              value={cfg.sucessao.honorarios_pct}
              onChange={(e) => setCfg((c) => ({ ...c, sucessao: { ...c.sucessao, honorarios_pct: e.target.value } }))}
            />
            <Field
              label="ITCMD (%)"
              type="number"
              value={cfg.sucessao.itcmd_pct}
              onChange={(e) => setCfg((c) => ({ ...c, sucessao: { ...c.sucessao, itcmd_pct: e.target.value } }))}
            />
          </div>
          <p className="text-text-faint text-[11px] mt-2">
            Honorários e ITCMD incidem sobre o patrimônio líquido ({formatarMoeda(pl)}). ITCMD varia por estado (0% a 8%).
          </p>
          <div className="mt-4 rounded-[9px] bg-panel-2 px-4 py-3">
            <div className="text-[12px] font-semibold">Necessidades imediatas</div>
            <div className="text-text-faint text-[11px] mb-1">Total pra cobrir os custos de inventário da família.</div>
            <div className="font-mono text-accent text-[15px]">{formatarMoeda(vSucessao)}</div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => salvarConfig.mutate(cfg)} disabled={salvarConfig.isPending}>
              {salvarConfig.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </ModalProtecao>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">Minhas apólices</div>
          {!mostrarForm && (
            <Button onClick={() => { setForm(APOLICE_VAZIA); setEditandoId(null); setMostrarForm(true) }}>+ Nova apólice</Button>
          )}
        </div>

        {mostrarForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              salvarApolice()
            }}
            className="border border-line rounded-[9px] p-4 mb-4"
          >
            <div className="text-[12px] font-semibold mb-3">
              {editandoId ? "Editar apólice" : "Nova apólice"}
            </div>
            <div className="flex gap-3 flex-wrap items-start">
              <div className="w-52">
                {titulares.length > 0 ? (
                  <Select
                    label="Titular da apólice"
                    value={form.titular}
                    onChange={(e) => setForm((f) => ({ ...f, titular: e.target.value }))}
                  >
                    <option value="">Selecione o titular…</option>
                    {titulares.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                ) : (
                  <Field
                    label="Titular da apólice"
                    value={form.titular}
                    onChange={(e) => setForm((f) => ({ ...f, titular: e.target.value }))}
                    placeholder="ex: quem é o segurado"
                  />
                )}
              </div>
              <div className="w-44">
                <Field
                  label="Instituição"
                  value={form.seguradora}
                  onChange={(e) => setForm((f) => ({ ...f, seguradora: e.target.value }))}
                  placeholder="ex: Porto Seguro"
                />
              </div>
              <div className="w-44">
                <Select label="Tipo do seguro" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPOS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-36">
                <Field
                  label="Cobertura total (R$)"
                  type="number"
                  value={form.valor_cobertura}
                  onChange={(e) => setForm((f) => ({ ...f, valor_cobertura: e.target.value }))}
                />
              </div>
              <div className="w-36">
                <Field
                  label="Prêmio (R$)"
                  type="number"
                  value={form.premio_mensal}
                  onChange={(e) => setForm((f) => ({ ...f, premio_mensal: e.target.value }))}
                />
              </div>
              <div className="w-40">
                <Field
                  label="Vigência início"
                  type="date"
                  value={form.vigencia_inicio}
                  onChange={(e) => setForm((f) => ({ ...f, vigencia_inicio: e.target.value }))}
                />
              </div>
              <div className="w-40">
                <Field
                  label="Vigência final"
                  type="date"
                  value={form.vencimento}
                  onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!form.seguradora.trim() || !form.valor_cobertura || salvandoApolice}>
                {salvandoApolice
                  ? "Salvando…"
                  : editandoId
                    ? "Salvar alterações"
                    : "Adicionar apólice"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setForm(APOLICE_VAZIA); setEditandoId(null); setMostrarForm(false) }}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {!data.apolices.length && (
          <p className="text-text-faint text-[12.5px] text-center py-6">
            Nenhuma apólice cadastrada ainda.
          </p>
        )}
        {data.apolices.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-line last:border-0">
            <div>
              <div className="text-[13px] font-medium flex items-center gap-2">
                {TIPOS[a.tipo]} · {a.seguradora}
                {a.titular && (
                  <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-panel-2 text-text-dim">{a.titular}</span>
                )}
              </div>
              <div className="text-text-faint text-[11px] font-mono">
                {formatarMoeda(a.valor_cobertura)} de cobertura
                {a.premio_mensal ? ` · ${formatarMoeda(a.premio_mensal)}/mês` : ""}
                {a.vigencia_inicio ? ` · de ${formatarData(a.vigencia_inicio)}` : ""}
                {a.vencimento ? ` até ${formatarData(a.vencimento)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => editarApolice(a)} className="text-text-faint hover:text-accent text-[12px]">
                Editar
              </button>
              <button onClick={() => excluir.mutate(a.id)} className="text-text-faint hover:text-red text-[12px]">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
