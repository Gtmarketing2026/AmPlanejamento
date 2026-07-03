import Card from "./Card"

const DELTA_COLOR = {
  accent: "text-accent",
  red: "text-red",
  faint: "text-text-faint",
}

export default function KpiStat({ label, value, delta, deltaColor = "faint" }) {
  return (
    <Card>
      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">{label}</div>
      <div className="font-display text-xl font-semibold mb-1">{value}</div>
      {delta && <div className={`text-[12px] ${DELTA_COLOR[deltaColor]}`}>{delta}</div>}
    </Card>
  )
}
