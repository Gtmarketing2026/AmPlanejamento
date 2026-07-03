export default function DonutChart({ pct = 0, size = 52, color = "var(--color-accent)" }) {
  const deg = Math.max(0, Math.min(100, pct)) * 3.6
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(${color} ${deg}deg, var(--color-line) ${deg}deg)`,
      }}
      className="relative shrink-0"
    >
      <div
        className="absolute rounded-full bg-panel-2"
        style={{ inset: size * 0.16 }}
      />
    </div>
  )
}
