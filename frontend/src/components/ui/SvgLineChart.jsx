export default function SvgLineChart({
  data,
  labels = [],
  width = 560,
  height = 140,
  color = "#4C8DFF",
  gradientId = "line-chart-gradient",
}) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padY = 10
  const stepX = width / (data.length - 1)

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - padY - ((v - min) / range) * (height - padY * 2)
    return [x, y]
  })

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x},${y}`).join(" ")
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === points.length - 1 ? 4 : 3}
            fill={i === points.length - 1 ? color : "transparent"}
            stroke={color}
            strokeWidth="1.5"
          />
        ))}
      </svg>
      {labels.length > 0 && (
        <div className="flex justify-between text-[11px] text-text-faint font-mono mt-1">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}
