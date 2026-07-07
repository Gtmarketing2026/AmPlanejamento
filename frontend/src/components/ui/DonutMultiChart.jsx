import { formatarMoeda } from "../../lib/format"

// Donut com várias fatias (ex: Ativos = Liquidez + Investimentos + Bens).
// Sem lib de gráfico -- conic-gradient puro, mesma convenção do DonutChart.
export default function DonutMultiChart({ fatias, size = 140, centroLabel, centroValor }) {
  const total = fatias.reduce((s, f) => s + Math.max(0, f.valor), 0)
  let acumulado = 0
  const paradas = fatias.map((f) => {
    const inicio = acumulado
    const pct = total > 0 ? (Math.max(0, f.valor) / total) * 100 : 0
    acumulado += pct
    return { ...f, inicio, fim: acumulado, pct }
  })

  const gradiente =
    total > 0
      ? paradas.map((f) => `${f.cor} ${f.inicio * 3.6}deg ${f.fim * 3.6}deg`).join(", ")
      : "var(--color-line) 0deg 360deg"

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div
        style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${gradiente})` }}
        className="relative shrink-0"
      >
        <div
          className="absolute rounded-full bg-panel flex flex-col items-center justify-center text-center"
          style={{ inset: size * 0.24 }}
        >
          {centroLabel && <div className="text-[10px] text-text-faint uppercase">{centroLabel}</div>}
          {centroValor && <div className="text-[13px] font-semibold">{centroValor}</div>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {fatias.map((f) => (
          <div key={f.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.cor }} />
            <span className="text-text-dim">{f.label}</span>
            <span className="font-mono text-text ml-1">{formatarMoeda(f.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
