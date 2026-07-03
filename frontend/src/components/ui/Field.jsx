export function Label({ children }) {
  return (
    <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">
      {children}
    </div>
  )
}

export default function Field({ label, className = "", ...props }) {
  return (
    <div className="mb-3">
      {label && <Label>{label}</Label>}
      <input
        className={`w-full bg-bg border border-line rounded-[9px] px-3.5 py-3 text-[13.5px] text-text placeholder:text-text-faint outline-none focus:border-accent/60 ${className}`}
        {...props}
      />
    </div>
  )
}

export function Select({ label, className = "", children, ...props }) {
  return (
    <div className="mb-3">
      {label && <Label>{label}</Label>}
      <select
        className={`w-full bg-bg border border-line rounded-[9px] px-3.5 py-3 text-[13.5px] text-text outline-none focus:border-accent/60 ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function StaticField({ label, children }) {
  return (
    <div className="mb-3">
      {label && <Label>{label}</Label>}
      <div className="w-full bg-bg border border-line rounded-[9px] px-3.5 py-3 text-[13.5px] text-text">
        {children}
      </div>
    </div>
  )
}
