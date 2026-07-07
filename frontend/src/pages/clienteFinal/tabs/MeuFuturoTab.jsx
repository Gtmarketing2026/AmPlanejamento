import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field from "../../../components/ui/Field"
import SvgLineChart from "../../../components/ui/SvgLineChart"
import {
  criarMinhaSimulacao,
  excluirMinhaSimulacao,
  listarMinhasSimulacoes,
  obterMeuPatrimonio,
} from "../../../api/patrimonio"
import { formatarMoeda } from "../../../lib/format"

const TAXA_ACUMULACAO_PADRAO = 4
const TAXA_POS_APOSENTADORIA_PADRAO = 3.5
const IDADE_MAXIMA = 100

function fvMensal(patrimonioInicial, aporteMensal, taxaAnualPct, meses) {
  const i = taxaAnualPct / 100 / 12
  if (i === 0) return patrimonioInicial + aporteMensal * meses
  const fator = Math.pow(1 + i, meses)
  return patrimonioInicial * fator + aporteMensal * ((fator - 1) / i)
}

function aporteNecessario(patrimonioInicial, valorAlvo, taxaAnualPct, anos) {
  const i = taxaAnualPct / 100 / 12
  const n = Math.max(1, anos * 12)
  let pmt
  if (i === 0) {
    pmt = (valorAlvo - patrimonioInicial) / n
  } else {
    const fator = Math.pow(1 + i, n)
    pmt = ((valorAlvo - patrimonioInicial * fator) * i) / (fator - 1)
  }
  return Math.max(0, pmt)
}

function patrimonioNecessario(rendaDesejada, outrasRendas, taxaPosPct) {
  const rendaFaltante = Math.max(0, rendaDesejada - outrasRendas)
  const iMensal = taxaPosPct / 100 / 12
  if (iMensal <= 0) return rendaFaltante * 12 * 100
  return rendaFaltante / iMensal
}

function curvaPorIdade({ idadeAtual, idadeAposentadoria, patrimonioInicial, aporteMensal, taxaAcumPct, taxaPosPct, rendaDesejada, outrasRendas, idadeFinal }) {
  const iAcum = taxaAcumPct / 100 / 12
  const iPos = taxaPosPct / 100 / 12
  const rendaFaltanteMensal = Math.max(0, rendaDesejada - outrasRendas)
  let saldo = patrimonioInicial
  const pontos = [{ idade: idadeAtual, valor: saldo }]
  for (let idade = idadeAtual + 1; idade <= idadeFinal; idade++) {
    for (let m = 0; m < 12; m++) {
      if (idade <= idadeAposentadoria) {
        saldo = saldo * (1 + iAcum) + aporteMensal
      } else {
        saldo = saldo * (1 + iPos) - rendaFaltanteMensal
      }
    }
    pontos.push({ idade, valor: saldo })
  }
  return pontos
}

export default function MeuFuturoTab({ token }) {
  const qc = useQueryClient()
  const { data: patrimonio } = useQuery({
    queryKey: ["cliente-eu-patrimonio", token],
    queryFn: () => obterMeuPatrimonio(token),
    enabled: !!token,
  })
  const { data: simulacoes = [] } = useQuery({
    queryKey: ["cliente-eu-simulacoes", token],
    queryFn: () => listarMinhasSimulacoes(token),
    enabled: !!token,
  })

  const [idadeAtual, setIdadeAtual] = useState(30)
  const [idadeAposentadoria, setIdadeAposentadoria] = useState(65)
  const [rendaDesejada, setRendaDesejada] = useState(8000)
  const [outrasRendas, setOutrasRendas] = useState(0)
  const [aporteMensal, setAporteMensal] = useState(1000)
  const [patrimonioInicial, setPatrimonioInicial] = useState(0)
  const [patrimonioEditadoManualmente, setPatrimonioEditadoManualmente] = useState(false)

  const [taxaAcumulacao, setTaxaAcumulacao] = useState(TAXA_ACUMULACAO_PADRAO)
  const [taxaPos, setTaxaPos] = useState(TAXA_POS_APOSENTADORIA_PADRAO)
  const [configAberta, setConfigAberta] = useState(false)
  const [taxaAcumTemp, setTaxaAcumTemp] = useState(TAXA_ACUMULACAO_PADRAO)
  const [taxaPosTemp, setTaxaPosTemp] = useState(TAXA_POS_APOSENTADORIA_PADRAO)

  const [janela, setJanela] = useState("max") // "5" | "10" | "max"
  const [mostrarNegativos, setMostrarNegativos] = useState(false)

  useEffect(() => {
    if (patrimonio && !patrimonioEditadoManualmente) {
      setPatrimonioInicial(Math.max(0, Math.round(patrimonio.patrimonio_liquido)))
    }
  }, [patrimonio, patrimonioEditadoManualmente])

  const salvar = useMutation({
    mutationFn: () =>
      criarMinhaSimulacao(token, {
        nome_cenario: "Cenário base",
        patrimonio_inicial: patrimonioInicial,
        aporte_mensal: aporteMensal,
        taxa_retorno_anual_pct: taxaAcumulacao,
        prazo_anos: Math.max(1, idadeAposentadoria - idadeAtual),
        idade_atual: idadeAtual,
        idade_aposentadoria: idadeAposentadoria,
        renda_desejada_mensal: rendaDesejada,
        outras_rendas_mensal: outrasRendas,
        taxa_pos_aposentadoria_pct: taxaPos,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-simulacoes", token] }),
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaSimulacao(token, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-simulacoes", token] }),
  })

  const anosAcumulacao = Math.max(1, idadeAposentadoria - idadeAtual)
  const patrimonioAlvo = useMemo(
    () => patrimonioNecessario(rendaDesejada, outrasRendas, taxaPos),
    [rendaDesejada, outrasRendas, taxaPos]
  )
  const aporteAlvo = useMemo(
    () => aporteNecessario(patrimonioInicial, patrimonioAlvo, taxaAcumulacao, anosAcumulacao),
    [patrimonioInicial, patrimonioAlvo, taxaAcumulacao, anosAcumulacao]
  )
  const patrimonioNaAposentadoria = useMemo(
    () => fvMensal(patrimonioInicial, aporteMensal, taxaAcumulacao, anosAcumulacao * 12),
    [patrimonioInicial, aporteMensal, taxaAcumulacao, anosAcumulacao]
  )

  const idadeFinalJanela =
    janela === "5" ? Math.min(IDADE_MAXIMA, idadeAtual + 5) : janela === "10" ? Math.min(IDADE_MAXIMA, idadeAtual + 10) : IDADE_MAXIMA

  const curva = useMemo(
    () =>
      curvaPorIdade({
        idadeAtual,
        idadeAposentadoria,
        patrimonioInicial,
        aporteMensal,
        taxaAcumPct: taxaAcumulacao,
        taxaPosPct: taxaPos,
        rendaDesejada,
        outrasRendas,
        idadeFinal: idadeFinalJanela,
      }),
    [idadeAtual, idadeAposentadoria, patrimonioInicial, aporteMensal, taxaAcumulacao, taxaPos, rendaDesejada, outrasRendas, idadeFinalJanela]
  )

  const valoresGrafico = mostrarNegativos ? curva.map((p) => p.valor) : curva.map((p) => Math.max(0, p.valor))
  const labels = [curva[0]?.idade, curva[Math.floor(curva.length / 2)]?.idade, curva[curva.length - 1]?.idade]

  function abrirConfig() {
    setTaxaAcumTemp(taxaAcumulacao)
    setTaxaPosTemp(taxaPos)
    setConfigAberta(true)
  }
  function salvarConfig() {
    setTaxaAcumulacao(taxaAcumTemp)
    setTaxaPos(taxaPosTemp)
    setConfigAberta(false)
  }
  function restaurarPadrao() {
    setTaxaAcumTemp(TAXA_ACUMULACAO_PADRAO)
    setTaxaPosTemp(TAXA_POS_APOSENTADORIA_PADRAO)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
            Independência financeira
          </div>
          <div className="flex items-center gap-2">
            {["5", "10", "max"].map((j) => (
              <button
                key={j}
                onClick={() => setJanela(j)}
                className={`px-2.5 py-1 rounded-[7px] text-[11.5px] font-semibold border ${
                  janela === j ? "border-accent text-accent" : "border-line text-text-faint hover:text-text-dim"
                }`}
              >
                {j === "max" ? "Máximo" : `${j} anos`}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-[11.5px] text-text-faint cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={mostrarNegativos}
                onChange={(e) => setMostrarNegativos(e.target.checked)}
                className="accent-accent"
              />
              Negativos
            </label>
            <button
              onClick={abrirConfig}
              title="Configurações da simulação"
              className="w-7 h-7 rounded-[7px] border border-line text-text-faint hover:text-text flex items-center justify-center"
            >
              ⚙
            </button>
          </div>
        </div>

        <SvgLineChart data={valoresGrafico} labels={labels} color="#26D9A8" gradientId="meu-futuro-chart" />

        <div className="mt-4 p-4 rounded-[10px] bg-panel-2 border border-line">
          <p className="text-[13.5px]">
            Você precisa investir <strong className="text-accent">{formatarMoeda(aporteAlvo)}/mês</strong> para
            chegar na sua aposentadoria ideal com{" "}
            <strong className="text-accent">{formatarMoeda(patrimonioAlvo)}</strong> acumulados.
          </p>
          <p className="text-text-faint text-[11.5px] mt-1">
            Com o aporte atual de {formatarMoeda(aporteMensal)}/mês, você projeta chegar aos {idadeAposentadoria}{" "}
            anos com {formatarMoeda(patrimonioNaAposentadoria)}.
          </p>
        </div>
      </Card>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Parâmetros</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-md:grid-cols-1">
          <SliderCampo label="Idade atual" valor={idadeAtual} min={16} max={90} onChange={setIdadeAtual} />
          <SliderCampo
            label="Idade de aposentadoria"
            valor={idadeAposentadoria}
            min={idadeAtual + 1}
            max={95}
            onChange={setIdadeAposentadoria}
          />
          <SliderCampo
            label="Renda desejada"
            valor={rendaDesejada}
            min={0}
            max={30000}
            step={100}
            formatador={formatarMoeda}
            onChange={setRendaDesejada}
          />
          <SliderCampo
            label="Outras fontes de renda"
            valor={outrasRendas}
            min={0}
            max={20000}
            step={100}
            formatador={formatarMoeda}
            onChange={setOutrasRendas}
          />
          <SliderCampo
            label="Investimento mensal"
            valor={aporteMensal}
            min={0}
            max={20000}
            step={50}
            formatador={formatarMoeda}
            onChange={setAporteMensal}
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-text-faint uppercase tracking-wide font-mono">
                Patrimônio inicial
              </span>
              <span className="font-mono text-[12.5px]">{formatarMoeda(patrimonioInicial)}</span>
            </div>
            <input
              type="number"
              value={patrimonioInicial}
              onChange={(e) => {
                setPatrimonioInicial(Number(e.target.value) || 0)
                setPatrimonioEditadoManualmente(true)
              }}
              className="w-full bg-bg border border-line rounded-[9px] px-3 py-2 text-[13px] text-text outline-none focus:border-accent/60"
            />
            <p className="text-text-faint text-[10.5px] mt-1">Puxado do seu Patrimônio — pode ajustar.</p>
          </div>
        </div>

        <Button className="mt-4" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : "Salvar cenário"}
        </Button>
      </Card>

      {simulacoes.length > 0 && (
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Cenários salvos
          </div>
          <div className="flex flex-col gap-2">
            {simulacoes.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border border-line rounded-[9px] px-3.5 py-2.5"
              >
                <div>
                  <div className="text-[13px] font-medium">{s.nome_cenario}</div>
                  <div className="text-text-faint text-[11.5px] font-mono">
                    {formatarMoeda(s.aporte_mensal)}/mês · {s.taxa_retorno_anual_pct}% a.a. · aposentadoria aos{" "}
                    {s.idade_aposentadoria || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] text-accent">
                    {s.aporte_necessario ? `${formatarMoeda(s.aporte_necessario)}/mês` : formatarMoeda(s.valor_final_projetado)}
                  </span>
                  <button
                    onClick={() => excluir.mutate(s.id)}
                    className="text-text-faint hover:text-red text-[11.5px]"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {configAberta && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setConfigAberta(false)}
        >
          <div
            className="bg-panel border border-line rounded-[14px] p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-[16px] font-semibold">Configurações da simulação</h3>
              <button onClick={() => setConfigAberta(false)} className="text-text-faint hover:text-text">
                ✕
              </button>
            </div>
            <Field
              label="Taxa de juros real anual na fase de acumulação (%)"
              type="number"
              step="0.1"
              value={taxaAcumTemp}
              onChange={(e) => setTaxaAcumTemp(Number(e.target.value))}
            />
            <Field
              label="Taxa de juros real anual após aposentadoria (%)"
              type="number"
              step="0.1"
              value={taxaPosTemp}
              onChange={(e) => setTaxaPosTemp(Number(e.target.value))}
            />
            <div className="bg-blue/10 text-blue text-[12px] rounded-[9px] p-3 mb-4 leading-relaxed">
              As taxas padrão estão de acordo com uma visão conservadora do mercado (juros já descontada a
              inflação). Alterar os valores pode gerar uma simulação que não condiz com a realidade.
            </div>
            <div className="flex items-center justify-between">
              <button onClick={restaurarPadrao} className="text-accent text-[12.5px] hover:underline">
                Voltar às taxas padrão
              </button>
              <Button onClick={salvarConfig}>Salvar configuração</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SliderCampo({ label, valor, min, max, step = 1, formatador, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-text-faint uppercase tracking-wide font-mono">{label}</span>
        <span className="font-mono text-[12.5px]">{formatador ? formatador(valor) : valor}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  )
}
