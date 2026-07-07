export default function Tabs({ options, active, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 bg-panel border border-line rounded-[10px] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3.5 py-2 rounded-[7px] text-[12.5px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            active === opt.value
              ? "bg-accent text-[#062019]"
              : "text-text-dim hover:text-text"
          }`}
        >
          {opt.n && (
            <span className={`font-mono text-[10px] ${active === opt.value ? "opacity-55" : "opacity-60"}`}>
              {opt.n}
            </span>
          )}
          {opt.label}
        </button>
      ))}
    </div>
  )
}
