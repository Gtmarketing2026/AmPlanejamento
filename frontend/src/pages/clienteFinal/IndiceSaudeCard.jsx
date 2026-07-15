import { useQuery } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import Termometro from "../../components/ui/Termometro"
import { obterIndiceSaude } from "../../api/patrimonio"

// Cor de cada zona -- mesma paleta do termômetro (vermelho -> azul/verde).
const COR_ZONA = {
  "Na contramão": "#E5645A",
  "Desvio de rota": "#F0A63C",
  "Zona de atenção": "#EAD94C",
  "A todo vapor": "#26D9A8",
  "Sem dados": "#5A6570",
}
// Cada dimensão leva pra aba que tem o detalhe/edição (não duplica dado).
const TAB_DA_DIMENSAO = {
  organizacao: "clareza",
  patrimonio: "patrimonio",
  liberdade: "futuro",
  gestao_ativos: "investimentos",
}

// Anel de score 0-100 (SVG) colorido pela zona.
function Anel({ score, cor }) {
  const raio = 16
  const circ = 2 * Math.PI * raio
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score))
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" className="shrink-0">
      <circle cx="21" cy="21" r={raio} fill="none" stroke="var(--color-line)" strokeWidth="4" />
      <circle
        cx="21"
        cy="21"
        r={raio}
        fill="none"
        stroke={cor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        transform="rotate(-90 21 21)"
      />
      <text x="21" y="25" textAnchor="middle" style={{ fontSize: 12, fontWeight: 600, fill: "var(--color-text)" }}>
        {score == null ? "–" : score}
      </text>
    </svg>
  )
}

function DimensaoCard({ dim, onIrParaTab }) {
  const cor = COR_ZONA[dim.zona] || COR_ZONA["Sem dados"]
  return (
    <div className="rounded-[11px] border border-line bg-panel-2 p-4 flex flex-col">
      <div className="flex items-center gap-3 mb-2.5">
        <Anel score={dim.score} cor={cor} />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-text truncate">{dim.nome}</div>
          <div className="text-[11.5px]" style={{ color: cor }}>
            {dim.score == null ? "Sem dados" : `${dim.score} de 100 · ${dim.zona}`}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        {dim.mensagens.slice(0, 2).map((m, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <span className="text-[12px] mt-0.5">
              {m.tipo === "alerta" ? "⚠️" : m.tipo === "positivo" ? "✅" : "•"}
            </span>
            <p className={`text-[11.5px] leading-snug ${m.tipo === "positivo" ? "text-accent" : "text-text-dim"}`}>
              {m.texto}
            </p>
          </div>
        ))}
      </div>
      <button
        onClick={() => onIrParaTab?.(TAB_DA_DIMENSAO[dim.chave])}
        className="text-accent text-[12px] hover:underline text-left mt-2.5"
      >
        Ver detalhe →
      </button>
    </div>
  )
}

export default function IndiceSaudeCard({ token, contexto = "PF", onIrParaTab }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-indice-saude", token, contexto],
    queryFn: () => obterIndiceSaude(token, contexto),
    enabled: !!token,
  })

  if (isLoading || !data) return null
  const semDados = data.zona === "Sem dados"
  const corGeral = COR_ZONA[data.zona] || COR_ZONA["Sem dados"]

  return (
    <Card className="mb-5">
      <div className="flex flex-col items-center pt-1 pb-3">
        <Termometro score={data.indice_geral} semDados={semDados} label="" />
        <div className="flex flex-col items-center">
          <div className="font-display text-[30px] font-semibold leading-none" style={{ color: semDados ? undefined : corGeral }}>
            {semDados ? "–" : data.indice_geral}
          </div>
          <div className="text-[12.5px] font-medium mt-1" style={{ color: semDados ? undefined : corGeral }}>
            {data.zona}
          </div>
        </div>
        <div className="text-text-faint text-[11.5px] mt-1.5">índice geral de saúde financeira</div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1 pt-3 border-t border-line">
        {data.dimensoes.map((dim) => (
          <DimensaoCard key={dim.chave} dim={dim} onIrParaTab={onIrParaTab} />
        ))}
      </div>

      <p className="text-text-faint text-[11px] mt-3 text-center">
        Índice automático de referência (0–100), média das 4 dimensões — não substitui a análise do seu planejador.
      </p>
    </Card>
  )
}
