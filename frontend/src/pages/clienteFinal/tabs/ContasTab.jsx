import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import BarRow from "../../../components/ui/BarRow"
import Field, { Select } from "../../../components/ui/Field"
import {
  atualizarMinhaConta,
  criarMinhaConta,
  excluirMinhaConta,
  listarMinhasContas,
} from "../../../api/contas"
import { formatarMoeda } from "../../../lib/format"

const FORM_VAZIO = { natureza: "conta", nome_exibicao: "", banco: "", saldo_manual: "", limite_total: "", dia_virada: "", contexto: "ambos", de_conjuge: false }
const CONTEXTO_LABEL = { PF: "Pessoal", PJ: "Empresa", ambos: "Pessoal e Empresa" }

export default function ContasTab({ token, contexto = "PF", temCnpj = false }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(FORM_VAZIO)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [ajustandoId, setAjustandoId] = useState(null)
  const [valorAjuste, setValorAjuste] = useState("")

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-contas", token],
    queryFn: () => listarMinhasContas(token),
    enabled: !!token,
  })

  const salvar = useMutation({
    mutationFn: () => {
      const dados = {
        nome_exibicao: form.nome_exibicao,
        banco: form.banco || null,
        saldo_manual: form.natureza === "conta" && form.saldo_manual !== "" ? Number(form.saldo_manual) : null,
        limite_total: form.natureza === "cartao" && form.limite_total !== "" ? Number(form.limite_total) : null,
        dia_virada: form.natureza === "cartao" && form.dia_virada !== "" ? Number(form.dia_virada) : null,
        contexto: form.contexto,
        de_conjuge: !!form.de_conjuge,
      }
      if (editandoId) return atualizarMinhaConta(token, editandoId, dados)
      return criarMinhaConta(token, { ...dados, natureza: form.natureza })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-contas", token] })
      setForm(FORM_VAZIO)
      setMostrarForm(false)
      setEditandoId(null)
    },
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaConta(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-contas", token] }),
  })

  // Ajustar saldo: o saldo da conta é somado automaticamente a partir dos
  // lançamentos vinculados a ela; aqui o cliente informa o valor CORRETO de
  // hoje e a gente calcula o ajuste (diferença) por trás -- os lançamentos
  // seguintes continuam somando normalmente em cima disso.
  const ajustarSaldo = useMutation({
    mutationFn: ({ conta, novoValor }) =>
      atualizarMinhaConta(token, conta.id, { saldo_manual: novoValor - Number(conta.saldo_automatico || 0) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-contas", token] })
      setAjustandoId(null)
      setValorAjuste("")
    },
  })

  function abrirAjuste(conta) {
    setAjustandoId(conta.id)
    setValorAjuste(String(conta.saldo_atual ?? 0))
  }

  function editar(conta) {
    setEditandoId(conta.id)
    setForm({
      natureza: conta.natureza,
      nome_exibicao: conta.nome_exibicao || "",
      banco: conta.banco || "",
      saldo_manual: conta.saldo_manual ?? "",
      limite_total: conta.limite_total ?? "",
      dia_virada: conta.dia_virada ?? "",
      contexto: conta.contexto || "ambos",
      de_conjuge: !!conta.de_conjuge,
    })
    setMostrarForm(true)
  }

  function novoForm(natureza) {
    setEditandoId(null)
    // Nova conta já entra marcada pra visão atual (Pessoal/Empresa) quando o
    // cliente tem PJ; sem PJ, tudo é "ambos".
    const contextoInicial = temCnpj ? (contexto === "PJ" ? "PJ" : "PF") : "ambos"
    setForm({ ...FORM_VAZIO, natureza, contexto: contextoInicial })
    setMostrarForm(true)
  }

  // Com PJ, cada visão (Pessoal/Empresa) mostra só as contas/cartões dela --
  // "ambos" aparece nas duas. Sem PJ, mostra tudo.
  const visiveis = contas.filter(
    (c) => !temCnpj || c.contexto === "ambos" || c.contexto === contexto
  )
  const contasBancarias = visiveis.filter((c) => c.natureza === "conta")
  const cartoes = visiveis.filter((c) => c.natureza === "cartao")
  const totalContas = contasBancarias.reduce((s, c) => s + Number(c.saldo_atual || 0), 0)
  const totalUsadoCartoes = cartoes.reduce((s, c) => s + Number(c.valor_usado || 0), 0)
  const totalLimiteCartoes = cartoes.reduce((s, c) => s + Number(c.limite_total || 0), 0)

  if (isLoading) return <p className="text-text-faint text-sm">Carregando…</p>

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">Contas</div>
            <button onClick={() => novoForm("conta")} className="text-accent text-[12px] hover:underline">
              + Nova conta
            </button>
          </div>
          <div className="text-[20px] font-display font-semibold mb-1">{formatarMoeda(totalContas)}</div>
          <div className="text-text-faint text-[11.5px]">Total em contas correntes</div>
        </Card>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">Cartões</div>
            <button onClick={() => novoForm("cartao")} className="text-accent text-[12px] hover:underline">
              + Novo cartão
            </button>
          </div>
          <div className="text-[20px] font-display font-semibold mb-1">
            {formatarMoeda(totalUsadoCartoes)}{" "}
            <span className="text-text-faint text-[13px] font-normal">de {formatarMoeda(totalLimiteCartoes)}</span>
          </div>
          <div
            className="text-text-faint text-[11.5px] cursor-help"
            title="Fatura do ciclo atual em diante, incluindo as parcelas futuras já lançadas (uma compra parcelada compromete o limite inteiro na hora). Faturas anteriores, já pagas, não contam."
          >
            Limite usado nos cartões (fatura atual + parcelas futuras)
          </div>
        </Card>
      </div>

      {mostrarForm && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            {editandoId ? "Editar" : form.natureza === "cartao" ? "Novo cartão" : "Nova conta"}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (form.nome_exibicao.trim()) salvar.mutate()
            }}
          >
            <div className="flex gap-3 flex-wrap items-start">
              <div className="flex-1 min-w-[180px]">
                <Field
                  label="Nome"
                  value={form.nome_exibicao}
                  onChange={(e) => setForm((f) => ({ ...f, nome_exibicao: e.target.value }))}
                  placeholder={form.natureza === "cartao" ? "ex: Itaú Platinum4800" : "ex: Nubank"}
                />
              </div>
              <div className="w-40">
                <Field
                  label="Banco/instituição"
                  value={form.banco}
                  onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
                  placeholder="ex: Itaú"
                />
              </div>
              {temCnpj && (
                <div className="w-40">
                  <Select
                    label="Entra em"
                    value={form.contexto}
                    onChange={(e) => setForm((f) => ({ ...f, contexto: e.target.value }))}
                  >
                    <option value="PF">Pessoal (PF)</option>
                    <option value="PJ">Empresa (PJ)</option>
                    <option value="ambos">Pessoal e Empresa</option>
                  </Select>
                </div>
              )}
              {form.natureza === "conta" ? (
                !editandoId && (
                  <div className="w-40">
                    <Field
                      label="Saldo inicial (R$)"
                      type="number"
                      value={form.saldo_manual}
                      onChange={(e) => setForm((f) => ({ ...f, saldo_manual: e.target.value }))}
                      placeholder="0,00"
                    />
                  </div>
                )
              ) : (
                <>
                  <div className="w-40">
                    <Field
                      label="Limite total (R$)"
                      type="number"
                      value={form.limite_total}
                      onChange={(e) => setForm((f) => ({ ...f, limite_total: e.target.value }))}
                    />
                  </div>
                  <div className="w-40">
                    <Field
                      label="Dia de virada (opcional)"
                      type="number"
                      min="1"
                      max="31"
                      value={form.dia_virada}
                      onChange={(e) => setForm((f) => ({ ...f, dia_virada: e.target.value }))}
                      placeholder="ex: 19"
                    />
                  </div>
                </>
              )}
            </div>
            <label className="flex items-center gap-2 mt-3 text-[12.5px] text-text-dim cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.de_conjuge}
                onChange={(e) => setForm((f) => ({ ...f, de_conjuge: e.target.checked }))}
                className="accent-accent"
              />
              {form.natureza === "cartao" ? "Este cartão é do cônjuge" : "Esta conta é do cônjuge"}
            </label>
            <div className="flex items-center gap-2 mt-2">
              <Button type="submit" disabled={!form.nome_exibicao.trim() || salvar.isPending}>
                {salvar.isPending ? "Salvando…" : editandoId ? "Salvar alterações" : "Adicionar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMostrarForm(false)
                  setEditandoId(null)
                  setForm(FORM_VAZIO)
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Minhas contas</div>
        {!contasBancarias.length && (
          <p className="text-text-faint text-[12.5px] py-3">Nenhuma conta cadastrada ainda.</p>
        )}
        {contasBancarias.map((c) => (
          <div key={c.id} className="py-2.5 border-b border-line last:border-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13.5px] font-medium flex items-center gap-2">
                  {c.nome_exibicao}
                  {c.de_conjuge && (
                    <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-blue/15 text-blue">cônjuge</span>
                  )}
                </div>
                {c.banco && <div className="text-text-faint text-[11px]">{c.banco}</div>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[13.5px]">{formatarMoeda(c.saldo_atual || 0)}</span>
                <button onClick={() => editar(c)} className="text-text-faint hover:text-text text-[11.5px]">
                  ✎
                </button>
                <button
                  onClick={() => confirm(`Excluir "${c.nome_exibicao}"? Isso remove também os lançamentos dela.`) && excluir.mutate(c.id)}
                  className="text-text-faint hover:text-red text-[11.5px]"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-text-faint text-[10.5px]">
                Atualizado automaticamente pelos lançamentos
              </span>
              {ajustandoId === c.id ? (
                <>
                  <input
                    type="number"
                    autoFocus
                    value={valorAjuste}
                    onChange={(e) => setValorAjuste(e.target.value)}
                    className="bg-bg border border-line rounded-[7px] px-2 py-1 text-[11.5px] text-text outline-none focus:border-accent/60 w-24"
                  />
                  <button
                    onClick={() => valorAjuste !== "" && ajustarSaldo.mutate({ conta: c, novoValor: Number(valorAjuste) })}
                    className="text-accent text-[11px] hover:underline"
                  >
                    OK
                  </button>
                  <button onClick={() => setAjustandoId(null)} className="text-text-faint text-[11px] hover:underline">
                    Cancelar
                  </button>
                </>
              ) : (
                <button onClick={() => abrirAjuste(c)} className="text-text-dim hover:text-text text-[10.5px] underline decoration-dotted">
                  ajustar saldo
                </button>
              )}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Meus cartões</div>
        {!cartoes.length && <p className="text-text-faint text-[12.5px] py-3">Nenhum cartão cadastrado ainda.</p>}
        {cartoes.map((c) => {
          const pct = c.limite_total ? Math.min(100, Math.round((c.valor_usado / c.limite_total) * 100)) : 0
          return (
            <div key={c.id} className="py-2.5 border-b border-line last:border-0">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <div className="text-[13.5px] font-medium flex items-center gap-2">
                    {c.nome_exibicao}
                    {c.de_conjuge && (
                      <span className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-blue/15 text-blue">cônjuge</span>
                    )}
                  </div>
                  <div className="text-text-faint text-[11px]">
                    {c.banco}
                    {c.dia_virada ? ` · vira dia ${c.dia_virada}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13.5px]">
                    {formatarMoeda(c.valor_usado)} <span className="text-text-faint">de {formatarMoeda(c.limite_total || 0)}</span>
                  </span>
                  <button onClick={() => editar(c)} className="text-text-faint hover:text-text text-[11.5px]">
                    ✎
                  </button>
                  <button
                    onClick={() => confirm(`Excluir "${c.nome_exibicao}"? Isso remove também os lançamentos dele.`) && excluir.mutate(c.id)}
                    className="text-text-faint hover:text-red text-[11.5px]"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <BarRow pct={pct} value={`${pct}%`} label="" />
            </div>
          )
        })}
      </Card>
    </div>
  )
}
