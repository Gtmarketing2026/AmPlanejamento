export function Table({ children }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[13px] border-collapse">{children}</table>
    </div>
  )
}

export function Thead({ children }) {
  return (
    <thead>
      <tr className="text-left text-[11px] text-text-faint uppercase tracking-wide font-mono">
        {children}
      </tr>
    </thead>
  )
}

export function Th({ children, className = "" }) {
  return <th className={`px-3 py-2 font-medium ${className}`}>{children}</th>
}

export function Tr({ children, className = "", ...props }) {
  return (
    <tr className={`border-t border-line ${className}`} {...props}>
      {children}
    </tr>
  )
}

export function Td({ children, className = "" }) {
  return <td className={`px-3 py-3 align-middle ${className}`}>{children}</td>
}
