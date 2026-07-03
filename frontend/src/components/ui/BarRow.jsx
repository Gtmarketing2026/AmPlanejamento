export default function BarRow({ label, pct, value, labelWidth = "w-[110px]" }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className={`${labelWidth} shrink-0 text-[12.5px] text-text-dim truncate`}>{label}</div>
      <div className="flex-1 h-2 rounded-full bg-bg overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
      <div className="w-20 shrink-0 text-right text-[12.5px] font-mono text-text">{value}</div>
    </div>
  )
}
