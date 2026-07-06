import Card from "./Card"

const DELTA_COLOR = {
  accent: "text-accent",
  red: "text-red",
  faint: "text-text-faint",
}

export default function KpiStat({ label, value, delta, deltaColor = "faint", info }) {
  return (
    <Card>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono">{label}</div>
        {info && (
          <span
            title={info}
            className="w-3.5 h-3.5 rounded-full border border-text-faint text-text-faint text-[9px] leading-[13px] text-center cursor-help select-none"
          >
            i
          </span>
        )}
      </div>
      <div className="font-display text-xl font-semibold mb-1">{value}</div>
      {delta && <div className={`text-[12px] ${DELTA_COLOR[deltaColor]}`}>{delta}</div>}
    </Card>
  )
}
