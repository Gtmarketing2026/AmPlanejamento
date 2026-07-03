import { useState, useRef, useEffect } from "react"
import { NavLink } from "react-router-dom"

export default function NavGroup({ label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3.5 py-2 rounded-[7px] text-[12.5px] font-semibold text-text-dim hover:text-text transition-colors"
      >
        {label} ▾
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-panel border border-line rounded-xl p-1.5 min-w-[220px] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)] z-50">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] transition-colors ${
                  isActive ? "bg-accent/10 text-accent" : "text-text-dim hover:text-text hover:bg-panel-2"
                }`
              }
            >
              {item.label}
              {item.completoOnly && (
                <span className="text-[10px] font-mono text-blue">completo</span>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
