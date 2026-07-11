import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import KpiStat from "../../../components/ui/KpiStat"
import Button from "../../../components/ui/Button"
import Field, { Select } from "../../../components/ui/Field"
import DonutMultiChart from "../../../components/ui/DonutMultiChart"
import {
  atualizarMeuBem,
  atualizarMinhaMilha,
  criarMeuBem,
  criarMinhaMilha,
  excluirMeuBem,
  excluirMinhaMilha,
  listarMeusBens,
  listarMinhasMilhas,
  obterMeuPatrimonio,
  obterMeuResumoPatrimonial,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

const MILHA_VAZIA = { categoria: "", programa: "", quantidade: "", proprietario: "titular", vencimento: "" }
const SUBTIPOS_IMOVEL = ["Residencial", "Veraneio", "Comercial", "Investimento", "Participação empresa"]

export default function PatrimonioTab({ token }) {
  const qc = useQueryClient()
  const BEM_VAZIO = { tipo: "movel", subtipo: "", nome: "", valor: "", proprietario: "titular", saldo_devedor: "", valor_prestacao: "" }
  const [form, setForm] = useState(BEM_VAZIO)
  const [editandoBemId, setEditandoBemId] = useState(null)
  const [milha, setMilha] = useState(MILHA_VAZIA)
  const [editandoMilhaId, setEditandoMilhaId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-patrimonio", token],
    queryFn: () => obterMeuPatrimonio(token),
    enabled: !!token,
  })
  const { data: resumo } = useQuery({
    queryKey: ["cliente-eu-patrimonio-resumo", token],
    queryFn: () => obterMeuResumoPatrimonial(token),
    enabled: !!token,
  })
  const { data: bens = [] } = useQuery({
    queryKey: ["cliente-eu-bens", token],
    queryFn: () => listarMeusBens(token),
    enabled: !!token,
  })
  const { data: milhas = [] } = useQuery({
    queryKey: ["cliente-eu-milhas", token],
    queryFn: () => listarMinhasMilhas(token),
    enabled: !!token,
  })
  // ---- Milhas: criar/editar compartilham o mesmo form ----
  const payloadMilha = () => ({
    categoria: milha.categoria || null,
    programa: milha.programa,
    quantidade: milha.quantidade ? Number(milha.quantidade) : 0,
    proprietario: milha.proprietario,
    vencimento: milha.vencimento || null,
  })
  const fecharMilha = () => {
    qc.invalidateQueries({ queryKey: ["cliente-eu-milhas", token] })
    setMilha(MILHA_VAZIA)
    setEditandoMilhaId(null)
  }
  const criarMilha = useMutation({ mutationFn: () => criarMinhaMilha(token, payloadMilha()), onSuccess: fecharMilha })
  const atualizarMilha = useMutation({
    mutationFn: () => atualizarMinhaMilha(token, editandoMilhaId, payloadMilha()),
    onSuccess: fecharMilha,
  })
  const salvandoMilha = criarMilha.isPending || atualizarMilha.isPending
  const editarMilha = (m) => {
    setMilha({
      categoria: m.categoria || "",
      programa: m.programa || "",
      quantidade: m.quantidade ?? "",
      proprietario: m.proprietario || "titular",
      vencimento: m.vencimento || "",
    })
    setEditandoMilhaId(m.id)
  }
  const salvarMilha = () => {
    if (!milha.programa.trim()) return
    ;(editandoMilhaId ? atualizarMilha : criarMilha).mutate()
  }
  const excluirMilha = useMutation({
    mutationFn: (id) => excluirMinhaMilha(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-milhas", token] }),
  })

  // ---- Bens: criar/editar compartilham o mesmo form ----
  const invalidarBens = () => {
    qc.invalidateQueries({ queryKey: ["cliente-eu-bens", token] })
    qc.invalidateQueries({ queryKey: ["cliente-eu-patrimonio", token] })
    qc.invalidateQueries({ queryKey: ["cliente-eu-patrimonio-resumo", token] })
  }
  const fecharBem = () => {
    invalidarBens()
    setForm(BEM_VAZIO)
    setEditandoBemId(null)
  }
  const payloadBem = () => ({
    tipo: form.tipo,
    subtipo: form.tipo === "imovel" ? form.subtipo || null : null,
    nome: form.nome,
    valor: Number(form.valor),
    proprietario: form.proprietario,
    saldo_devedor: form.saldo_devedor ? Number(form.saldo_devedor) : 0,
    // Prestação só faz sentido com saldo devedor -- zera se não houver.
    valor_prestacao: form.saldo_devedor && form.valor_prestacao ? Number(form.valor_prestacao) : 0,
  })
  const criar = useMutation({ mutationFn: () => criarMeuBem(token, payloadBem()), onSuccess: fecharBem })
  const atualizarBem = useMutation({
    mutationFn: () => atualizarMeuBem(token, editandoBemId, payloadBem()),
    onSuccess: fecharBem,
  })
  const salvandoBem = criar.isPending || atualizarBem.isPending
  const editarBem = (b) => {
    setForm({
      tipo: b.tipo,
      subtipo: b.subtipo || "",
      nome: b.nome,
      valor: b.valor ?? "",
      proprietario: b.proprietario || "titular",
      saldo_devedor: b.saldo_devedor ?? "",
      valor_prestacao: b.valor_prestacao ?? "",
    })
    setEditandoBemId(b.id)
  }
  const salvarBem = () => {
    if (!form.nome.trim() || !form.valor) return
    ;(editandoBemId ? atualizarBem : criar).mutate()
  }

  const excluir = useMutation({
    mutationFn: (id) => excluirMeuBem(token, id),
    onSuccess: invalidarBens,
  })

  if (isLoading) return <p className="text-text-faint text-sm">Carregando…</p>
  if (!data) return null

  const ativos = data.saldo_contas + data.total_investido + data.total_bens
  const bensMoveis = bens.filter((b) => b.tipo === "movel")
  const bensImoveis = bens.filter((b) => b.tipo === "imovel")

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <KpiStat
          label="Patrimônio líquido"
          value={formatarMoeda(data.patrimonio_liquido)}
          deltaColor={data.patrimonio_liquido >= 0 ? "accent" : "red"}
        />
        <KpiStat label="Total de ativos" value={formatarMoeda(ativos)} />
        <KpiStat label="Total de passivos" value={formatarMoeda(data.total_dividas)} deltaColor="red" />
      </div>

      {resumo && (ativos > 0 || resumo.passivos_dividas > 0) && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
              Resumo patrimonial
            </div>
            <div className="text-[12px] text-text-dim">
              <strong className="text-accent">{resumo.pct_ativo_gerador_renda}%</strong> dos seus ativos estão
              investidos (gerando renda)
            </div>
          </div>
          <DonutMultiChart
            centroLabel="Ativos"
            centroValor={formatarMoeda(ativos)}
            fatias={[
              { label: "Investimentos", valor: resumo.ativos_investimentos, cor: "#26D9A8" },
              { label: "Saldo em conta", valor: resumo.ativos_liquidez, cor: "#4C8DFF" },
              { label: "Bens móveis/imóveis", valor: resumo.ativos_bens, cor: "#F0A63C" },
            ]}
          />
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Ativos
          </div>
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-[13px] text-text-dim">Saldo em conta (entradas − saídas)</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.saldo_contas)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-[13px] text-text-dim">Investimentos</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.total_investido)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-[13px] text-text-dim">Bens móveis e imóveis</span>
            <span className="font-mono text-[13.5px]">{formatarMoeda(data.total_bens)}</span>
          </div>
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Passivos
          </div>
          <div className="flex justify-between items-center py-2 border-b border-line">
            <span className="text-[13px] text-text-dim">Dívidas em aberto</span>
            <span className="font-mono text-[13.5px] text-red">{formatarMoeda(data.total_dividas)}</span>
          </div>
          {/* Nível de endividamento = quanto do patrimônio está comprometido. */}
          <div className="flex justify-between items-center py-2">
            <span className="text-[13px] text-text-dim">Nível de endividamento</span>
            <span
              className={`font-mono text-[13.5px] ${
                ativos > 0 && data.total_dividas / ativos > 0.3 ? "text-red" : "text-text"
              }`}
            >
              {ativos > 0 ? Math.round((data.total_dividas / ativos) * 100) : 0}%
            </span>
          </div>
          <p className="text-text-faint text-[11px] mt-1">% do patrimônio comprometido com dívidas e financiamentos.</p>
        </Card>
      </div>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">
          {editandoBemId ? "Editar bem" : "Novo bem (móvel ou imóvel)"}
        </div>
        <p className="text-text-faint text-[11.5px] mb-3 leading-relaxed">
          <strong className="text-text-dim">Bem móvel</strong>: pode ser transportado — carro, moto, joias, obras de
          arte, equipamentos. <strong className="text-text-dim">Bem imóvel</strong>: preso ao solo — casa, apartamento,
          terreno, sala comercial.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvarBem()
          }}
          className="flex gap-3 flex-wrap items-start"
        >
          <div className="w-36">
            <Select label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, subtipo: "" }))}>
              <option value="movel">Bem móvel</option>
              <option value="imovel">Imóvel</option>
            </Select>
          </div>
          {form.tipo === "imovel" && (
            <div className="w-40">
              <Select label="Subtipo" value={form.subtipo} onChange={(e) => setForm((f) => ({ ...f, subtipo: e.target.value }))}>
                <option value="">Selecione…</option>
                {SUBTIPOS_IMOVEL.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex-1 min-w-[160px]">
            <Field
              label="Nome do bem"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder={form.tipo === "imovel" ? "ex: Apartamento" : "ex: Carro Onix 2020"}
            />
          </div>
          <div className="w-36">
            <Select
              label="Proprietário"
              value={form.proprietario}
              onChange={(e) => setForm((f) => ({ ...f, proprietario: e.target.value }))}
            >
              <option value="titular">Titular</option>
              <option value="conjuge">Cônjuge</option>
              <option value="ambos">Ambos</option>
            </Select>
          </div>
          <div className="w-36">
            <Field
              label="Valor do bem (R$)"
              type="number"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
          </div>
          <div className="w-36">
            <Field
              label="Saldo devedor (R$)"
              type="number"
              value={form.saldo_devedor}
              onChange={(e) => setForm((f) => ({ ...f, saldo_devedor: e.target.value }))}
              placeholder="se financiado"
            />
          </div>
          {Number(form.saldo_devedor) > 0 && (
            <div className="w-36">
              <Field
                label="Prestação (R$/mês)"
                type="number"
                value={form.valor_prestacao}
                onChange={(e) => setForm((f) => ({ ...f, valor_prestacao: e.target.value }))}
                placeholder="valor da parcela"
              />
              {Number(form.valor_prestacao) > 0 && (
                <p className="text-text-faint text-[10.5px] -mt-2">
                  ~{Math.ceil(Number(form.saldo_devedor) / Number(form.valor_prestacao))} parcelas restantes
                </p>
              )}
            </div>
          )}
          <Button type="submit" disabled={!form.nome.trim() || !form.valor || salvandoBem}>
            {salvandoBem ? "Salvando…" : editandoBemId ? "Salvar" : "Adicionar"}
          </Button>
          {editandoBemId && (
            <Button type="button" variant="ghost" onClick={() => { setForm(BEM_VAZIO); setEditandoBemId(null) }}>
              Cancelar
            </Button>
          )}
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Bens móveis ({formatarMoeda(bensMoveis.reduce((s, b) => s + Number(b.valor), 0))})
          </div>
          {!bensMoveis.length && <p className="text-text-faint text-[12.5px]">Nenhum bem móvel cadastrado.</p>}
          {bensMoveis.map((b) => (
            <div key={b.id} className="flex justify-between items-center py-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px]">{b.nome}</span>
                  {b.subtipo && (
                    <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-panel text-text-dim">{b.subtipo}</span>
                  )}
                  {b.proprietario && b.proprietario !== "titular" && (
                    <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-blue/15 text-blue">
                      {b.proprietario === "conjuge" ? "cônjuge" : "ambos"}
                    </span>
                  )}
                </div>
                {Number(b.saldo_devedor) > 0 && (
                  <div className="text-[11px] text-red font-mono">
                    deve {formatarMoeda(b.saldo_devedor)}
                    {Number(b.valor_prestacao) > 0 && (
                      <span className="text-text-faint">
                        {" "}· ~{Math.ceil(Number(b.saldo_devedor) / Number(b.valor_prestacao))}x de {formatarMoeda(b.valor_prestacao)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[13px]">{formatarMoeda(b.valor)}</span>
                <button onClick={() => editarBem(b)} className="text-text-faint hover:text-accent text-[11.5px]" title="Editar">
                  ✎
                </button>
                <button onClick={() => excluir.mutate(b.id)} className="text-text-faint hover:text-red text-[11.5px]" title="Excluir">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Bens imóveis ({formatarMoeda(bensImoveis.reduce((s, b) => s + Number(b.valor), 0))})
          </div>
          {!bensImoveis.length && <p className="text-text-faint text-[12.5px]">Nenhum imóvel cadastrado.</p>}
          {bensImoveis.map((b) => (
            <div key={b.id} className="flex justify-between items-center py-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px]">{b.nome}</span>
                  {b.subtipo && (
                    <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-panel text-text-dim">{b.subtipo}</span>
                  )}
                  {b.proprietario && b.proprietario !== "titular" && (
                    <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-blue/15 text-blue">
                      {b.proprietario === "conjuge" ? "cônjuge" : "ambos"}
                    </span>
                  )}
                </div>
                {Number(b.saldo_devedor) > 0 && (
                  <div className="text-[11px] text-red font-mono">
                    deve {formatarMoeda(b.saldo_devedor)}
                    {Number(b.valor_prestacao) > 0 && (
                      <span className="text-text-faint">
                        {" "}· ~{Math.ceil(Number(b.saldo_devedor) / Number(b.valor_prestacao))}x de {formatarMoeda(b.valor_prestacao)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[13px]">{formatarMoeda(b.valor)}</span>
                <button onClick={() => editarBem(b)} className="text-text-faint hover:text-accent text-[11.5px]" title="Editar">
                  ✎
                </button>
                <button onClick={() => excluir.mutate(b.id)} className="text-text-faint hover:text-red text-[11.5px]" title="Excluir">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Milhas aéreas */}
      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Milhas ({milhas.reduce((s, m) => s + Number(m.quantidade || 0), 0).toLocaleString("pt-BR")})
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvarMilha()
          }}
          className="flex gap-3 flex-wrap items-start mb-3"
        >
          <div className="w-40">
            <Field
              label="Categoria"
              value={milha.categoria}
              onChange={(e) => setMilha((m) => ({ ...m, categoria: e.target.value }))}
              placeholder="ex: Aérea"
            />
          </div>
          <div className="w-44">
            <Field
              label="Programa de milhagem"
              value={milha.programa}
              onChange={(e) => setMilha((m) => ({ ...m, programa: e.target.value }))}
              placeholder="ex: Smiles, Latam Pass"
            />
          </div>
          <div className="w-36">
            <Field
              label="Quantidade"
              type="number"
              value={milha.quantidade}
              onChange={(e) => setMilha((m) => ({ ...m, quantidade: e.target.value }))}
              placeholder="ex: 14000"
            />
          </div>
          <div className="w-36">
            <Select
              label="Proprietário"
              value={milha.proprietario}
              onChange={(e) => setMilha((m) => ({ ...m, proprietario: e.target.value }))}
            >
              <option value="titular">Titular</option>
              <option value="conjuge">Cônjuge</option>
            </Select>
          </div>
          <div className="w-40">
            <Field
              label="Vencimento (opcional)"
              type="date"
              value={milha.vencimento}
              onChange={(e) => setMilha((m) => ({ ...m, vencimento: e.target.value }))}
            />
          </div>
          <Button type="submit" disabled={!milha.programa.trim() || salvandoMilha} className="mb-3">
            {salvandoMilha ? "Salvando…" : editandoMilhaId ? "Salvar" : "Adicionar milhas"}
          </Button>
          {editandoMilhaId && (
            <Button type="button" variant="ghost" onClick={() => { setMilha(MILHA_VAZIA); setEditandoMilhaId(null) }} className="mb-3">
              Cancelar
            </Button>
          )}
        </form>
        {!milhas.length ? (
          <p className="text-text-faint text-[12.5px]">Nenhuma milha cadastrada.</p>
        ) : (
          <div className="flex flex-col">
            {milhas.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-medium">{m.programa}</span>
                  {m.categoria && <span className="text-text-faint text-[11.5px]">· {m.categoria}</span>}
                  {m.proprietario === "conjuge" && (
                    <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-blue/15 text-blue">cônjuge</span>
                  )}
                  {m.vencimento && (
                    <span className="text-text-faint text-[11px]">vence {new Date(m.vencimento).toLocaleDateString("pt-BR")}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px]">{Number(m.quantidade).toLocaleString("pt-BR")}</span>
                  <button onClick={() => editarMilha(m)} className="text-text-faint hover:text-accent text-[11.5px]" title="Editar">✎</button>
                  <button onClick={() => excluirMilha.mutate(m.id)} className="text-text-faint hover:text-red text-[11.5px]" title="Excluir">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
