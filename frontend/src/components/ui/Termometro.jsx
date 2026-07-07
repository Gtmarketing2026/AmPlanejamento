// Termômetro de saúde financeira -- meio-círculo com 5 faixas de cor
// (vermelho -> laranja -> amarelo -> verde -> azul) e um ponteiro indicando
// o score (0-100). Sem lib de gráfico, só SVG (mesma convenção do resto do
// design system).
const CORES = ["#E5645A", "#F0A63C", "#EAD94C", "#26D9A8", "#4C8DFF"]
const CX = 100
const CY = 95
const RAIO_EXTERNO = 90
const RAIO_INTERNO = 62

function polarParaCartesiano(cx, cy, raio, anguloGraus) {
  const anguloRad = ((anguloGraus - 180) * Math.PI) / 180
  return { x: cx + raio * Math.cos(anguloRad), y: cy + raio * Math.sin(anguloRad) }
}

function arcoFaixa(anguloInicio, anguloFim) {
  const p1 = polarParaCartesiano(CX, CY, RAIO_EXTERNO, anguloInicio)
  const p2 = polarParaCartesiano(CX, CY, RAIO_EXTERNO, anguloFim)
  const p3 = polarParaCartesiano(CX, CY, RAIO_INTERNO, anguloFim)
  const p4 = polarParaCartesiano(CX, CY, RAIO_INTERNO, anguloInicio)
  return `M ${p1.x} ${p1.y} A ${RAIO_EXTERNO} ${RAIO_EXTERNO} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${RAIO_INTERNO} ${RAIO_INTERNO} 0 0 0 ${p4.x} ${p4.y} Z`
}

export default function Termometro({ score, semDados, label }) {
  const anguloPonteiro = semDados ? 90 : (score / 100) * 180
  const pontaPonteiro = polarParaCartesiano(CX, CY, RAIO_INTERNO - 6, anguloPonteiro)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[280px]">
        {CORES.map((cor, i) => (
          <path key={cor} d={arcoFaixa(i * 36, (i + 1) * 36)} fill={cor} opacity={semDados ? 0.35 : 1} />
        ))}
        <circle cx={CX} cy={CY} r="4" fill="#E9EDF0" />
        <line
          x1={CX}
          y1={CY}
          x2={pontaPonteiro.x}
          y2={pontaPonteiro.y}
          stroke="#E9EDF0"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <div className="text-text-dim text-[13px] font-medium -mt-2">
        {semDados ? "Sem dados disponíveis" : label}
      </div>
    </div>
  )
}
