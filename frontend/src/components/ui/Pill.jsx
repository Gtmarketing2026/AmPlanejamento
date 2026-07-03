const VARIANTS = {
  on: "bg-accent/10 text-accent",
  warn: "bg-amber/10 text-amber",
  off: "bg-red/10 text-red",
  neutral: "bg-blue/10 text-blue",
}

export default function Pill({ variant = "on", pulse = false, children }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold ${VARIANTS[variant]}`}
    >
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  )
}
