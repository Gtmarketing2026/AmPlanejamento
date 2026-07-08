import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import { obterMinhaSaudeFinanceira } from "../../api/patrimonio"

// Classificação por cor -- mais clean que o termômetro colorido cheio.
// Combina reserva de emergência (meses de gasto cobertos) + taxa de poupança.
const CLASSIFICACAO = {
  vermelho: { label: "Vermelho", cor: "#E5645A", nota: "Precisa de atenção" },
  amarelo: { label: "Amarelo", cor: "#EAD94C", nota: "Regular — dá pra melhorar" },
  verde: { label: "Verde", cor: "#26D9A8", nota: "Saudável" },
  azul: { label: "Azul", cor: "#4C8DFF", nota: "Excelente" },
  neutro: { label: "Sem dados", cor: "#5A6570", nota: "Importe lançamentos pra ver" },
}

// Anel de progresso simples (conic-gradient) colorido pela classificação --
// preenche conforme a taxa de poupança do mês (0-100%).
function Anel({ cor, pct }) {
  const preenchido = Math.max(6, Math.min(100, pct))
  return (
    <div
      className="w-12 h-12 rounded-full shrink-0"
      style={{ background: `conic-gradient(${cor} ${preenchido * 3.6}deg, var(--color-line) 0deg)` }}
    >
      <div className="w-full h-full rounded-full flex items-center justify-center" style={{ padding: 4 }}>
        <div className="w-full h-full rounded-full bg-panel" />
      </div>
    </div>
  )
}

export default function SaudeFinanceiraCard({ token }) {
  const [verComo, setVerComo] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-saude-financeira", token],
    queryFn: () => obterMinhaSaudeFinanceira(token),
    enabled: !!token,
  })

  if (isLoading || !data) return null

  const c = CLASSIFICACAO[data.classificacao] || CLASSIFICACAO.neutro
  // Limiares configurados pelo planejador (fallback = defaults do sistema).
  const cr = data.criterios || {
    reserva_min_meses: 3,
    verde_reserva_meses: 6,
    verde_poupanca_pct: 15,
    azul_reserva_meses: 12,
    azul_poupanca_pct: 30,
  }
  const linkPlanejador = data.planejador_whatsapp
    ? `https://wa.me/55${data.planejador_whatsapp.replace(/\D/g, "")}`
    : null

  return (
    <Card className="mb-5">
      <div className="flex items-center gap-3.5">
        <Anel cor={c.cor} pct={data.taxa_poupanca_pct ?? 0} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[15px] font-semibold">
              Saúde financeira: <span style={{ color: c.cor }}>{c.label}</span>
            </span>
            <span
              className="text-[10.5px] font-mono font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${c.cor}1a`, color: c.cor }}
            >
              {c.nota}
            </span>
          </div>
          {data.tem_dados ? (
            <div className="text-text-dim text-[12.5px] mt-0.5">
              {data.reserva_meses != null && (
                <>
                  Reserva de emergência cobre <strong className="text-text">{data.reserva_meses} meses</strong> de gastos
                  {data.taxa_poupanca_pct != null && " · "}
                </>
              )}
              {data.taxa_poupanca_pct != null && (
                <>
                  taxa de poupança de <strong className="text-text">{data.taxa_poupanca_pct}%</strong> no mês
                </>
              )}
            </div>
          ) : (
            <div className="text-text-faint text-[12.5px] mt-0.5">
              Importe um extrato ou adicione lançamentos pra ver seu diagnóstico.
            </div>
          )}
        </div>
        <button
          onClick={() => setVerComo((v) => !v)}
          className="text-text-faint hover:text-text text-[11px] self-start whitespace-nowrap"
          title="Como é calculado"
        >
          Como funciona?
        </button>
      </div>

      {verComo && (
        <div className="mt-3 pt-3 border-t border-line text-text-dim text-[11.5px] leading-relaxed">
          A classificação combina dois indicadores do mês atual:
          <ul className="mt-1.5 space-y-1 list-disc pl-4">
            <li>
              <strong className="text-text">Reserva de emergência</strong> — quantos meses dos seus gastos o saldo
              disponível cobre.
            </li>
            <li>
              <strong className="text-text">Taxa de poupança</strong> — quanto da sua renda sobra no mês.
            </li>
          </ul>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="text-red">●</span> Vermelho: gasta mais do que ganha ou reserva &lt; {cr.reserva_min_meses} meses</span>
            <span><span className="text-amber">●</span> Amarelo: reserva a partir de {cr.reserva_min_meses} meses, ainda abaixo do Verde</span>
            <span><span className="text-accent">●</span> Verde: poupança ≥ {cr.verde_poupanca_pct}% e reserva ≥ {cr.verde_reserva_meses} meses</span>
            <span><span className="text-blue">●</span> Azul: poupança ≥ {cr.azul_poupanca_pct}% e reserva ≥ {cr.azul_reserva_meses} meses</span>
          </div>
          <p className="text-text-faint mt-2">É uma referência automática pra orientar — não substitui a análise do seu planejador.</p>
        </div>
      )}

      {data.mensagens.length > 0 && (
        <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-line">
          {data.mensagens.map((mm, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="text-[15px] mt-0.5">{mm.tipo === "alerta" ? "⚠️" : "✅"}</span>
                <p className={`text-[12.5px] leading-relaxed ${mm.tipo === "alerta" ? "text-text-dim" : "text-accent"}`}>
                  {mm.texto}
                </p>
              </div>
              {mm.tipo === "alerta" && linkPlanejador && (
                <a
                  href={linkPlanejador}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent text-[12px] font-semibold whitespace-nowrap hover:underline"
                >
                  Falar com planejador
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
