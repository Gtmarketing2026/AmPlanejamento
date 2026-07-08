import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import { obterCriteriosSaude, atualizarCriteriosSaude } from "../../api/configuracoes"
import { ApiError } from "../../api/client"

const PADRAO = {
  reserva_min_meses: 3,
  verde_reserva_meses: 6,
  verde_poupanca_pct: 15,
  azul_reserva_meses: 12,
  azul_poupanca_pct: 30,
}

const CORES = {
  vermelho: { label: "Vermelho", cor: "#E5645A", nota: "Precisa de atenção" },
  amarelo: { label: "Amarelo", cor: "#EAD94C", nota: "Regular — dá pra melhorar" },
  verde: { label: "Verde", cor: "#26D9A8", nota: "Saudável" },
  azul: { label: "Azul", cor: "#4C8DFF", nota: "Excelente" },
}

// Campo numérico com sufixo (meses / %), no visual do design system.
function CampoNumero({ label, value, onChange, sufixo, min = 0, step = 1 }) {
  return (
    <div>
      <div className="text-[12.5px] text-text-dim mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-bg border border-line rounded-[9px] px-3 py-2.5 text-[13.5px] text-text outline-none focus:border-accent/60 w-24"
        />
        <span className="text-text-faint text-[12px]">{sufixo}</span>
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["criterios-saude"],
    queryFn: obterCriteriosSaude,
  })

  const [form, setForm] = useState(PADRAO)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  function set(campo) {
    return (valor) => setForm((f) => ({ ...f, [campo]: valor }))
  }

  const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v))

  async function onSalvar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const dados = {
        reserva_min_meses: num(form.reserva_min_meses),
        verde_reserva_meses: num(form.verde_reserva_meses),
        verde_poupanca_pct: num(form.verde_poupanca_pct),
        azul_reserva_meses: num(form.azul_reserva_meses),
        azul_poupanca_pct: num(form.azul_poupanca_pct),
      }
      const atualizado = await atualizarCriteriosSaude(dados)
      setForm(atualizado)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar.")
    } finally {
      setEnviando(false)
    }
  }

  // Faixa em texto pra pré-visualização — reflete os valores atuais do form.
  const rm = num(form.reserva_min_meses)
  const vr = num(form.verde_reserva_meses)
  const vp = num(form.verde_poupanca_pct)
  const ar = num(form.azul_reserva_meses)
  const ap = num(form.azul_poupanca_pct)
  const faixas = [
    { ...CORES.vermelho, regra: `Gasta mais do que ganha, ou reserva cobre menos de ${rm} ${rm === 1 ? "mês" : "meses"}` },
    { ...CORES.amarelo, regra: `Reserva a partir de ${rm} ${rm === 1 ? "mês" : "meses"}, mas ainda não chega no Verde` },
    { ...CORES.verde, regra: `Poupança ≥ ${vp}% e reserva ≥ ${vr} meses` },
    { ...CORES.azul, regra: `Poupança ≥ ${ap}% e reserva ≥ ${ar} meses` },
  ]

  return (
    <Stage
      eyebrow="Configurações"
      title="Critérios da saúde financeira"
      description="Defina os limiares que classificam a saúde financeira dos seus clientes. Vale para todos os seus clientes e aparece no diagnóstico que eles veem."
    >
      {isLoading ? (
        <Card><p className="text-text-faint text-sm">Carregando…</p></Card>
      ) : (
        <div className="grid grid-cols-[1fr_360px] gap-7 max-md:grid-cols-1">
          <form onSubmit={onSalvar}>
            <Card className="mb-4">
              <div className="font-display font-semibold mb-1">Reserva de emergência</div>
              <p className="text-text-dim text-[12px] mb-3">
                Quantos meses dos gastos do cliente o saldo disponível cobre.
              </p>
              <CampoNumero
                label="Abaixo desta reserva o cliente fica no Vermelho"
                value={form.reserva_min_meses}
                onChange={set("reserva_min_meses")}
                sufixo="meses"
                step={0.5}
              />
            </Card>

            <Card className="mb-4" style={{ borderColor: "rgba(38,217,168,0.3)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full" style={{ background: CORES.verde.cor }} />
                <span className="font-display font-semibold">Verde (saudável)</span>
              </div>
              <p className="text-text-dim text-[12px] mb-3">
                Precisa cumprir <strong>as duas</strong> condições ao mesmo tempo.
              </p>
              <div className="flex gap-4 flex-wrap">
                <CampoNumero label="Taxa de poupança mínima" value={form.verde_poupanca_pct} onChange={set("verde_poupanca_pct")} sufixo="%" />
                <CampoNumero label="Reserva mínima" value={form.verde_reserva_meses} onChange={set("verde_reserva_meses")} sufixo="meses" step={0.5} />
              </div>
            </Card>

            <Card className="mb-4" style={{ borderColor: "rgba(76,141,255,0.3)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full" style={{ background: CORES.azul.cor }} />
                <span className="font-display font-semibold">Azul (excelente)</span>
              </div>
              <p className="text-text-dim text-[12px] mb-3">
                O nível mais alto — rumo à independência financeira. Deve ser mais exigente que o Verde.
              </p>
              <div className="flex gap-4 flex-wrap">
                <CampoNumero label="Taxa de poupança mínima" value={form.azul_poupanca_pct} onChange={set("azul_poupanca_pct")} sufixo="%" />
                <CampoNumero label="Reserva mínima" value={form.azul_reserva_meses} onChange={set("azul_reserva_meses")} sufixo="meses" step={0.5} />
              </div>
            </Card>

            {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={enviando}>
                {enviando ? "Salvando…" : "Salvar critérios"}
              </Button>
              <button
                type="button"
                onClick={() => setForm(PADRAO)}
                className="text-text-faint hover:text-text-dim text-[12.5px]"
              >
                Restaurar padrão
              </button>
              {salvo && <Pill variant="on">salvo</Pill>}
            </div>
          </form>

          <div>
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">
              Como o cliente é classificado
            </div>
            <Card>
              <div className="flex flex-col gap-3">
                {faixas.map((f) => (
                  <div key={f.label} className="flex items-start gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full mt-0.5 shrink-0" style={{ background: f.cor }} />
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: f.cor }}>
                        {f.label} <span className="text-text-faint font-normal">· {f.nota}</span>
                      </div>
                      <div className="text-text-dim text-[11.5px] leading-snug">{f.regra}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-text-faint text-[11px] mt-3 pt-3 border-t border-line leading-relaxed">
                O cliente vê essa mesma explicação no botão “Como funciona?” do diagnóstico. É uma
                referência automática — não substitui a sua análise.
              </p>
            </Card>
          </div>
        </div>
      )}
    </Stage>
  )
}
