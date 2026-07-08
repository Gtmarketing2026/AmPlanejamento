import { useId } from "react"

// Marca do AMplanejador -- barras ascendentes (crescimento/planejamento
// financeiro) num quadrado arredondado com o gradiente verde->azul da paleta.
// Mesma linguagem visual do favicon (public/favicon.svg).
export function LogoMark({ size = 26, className = "" }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="32" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#26D9A8" />
          <stop offset="1" stopColor="#4C8DFF" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
      <rect x="7.5" y="18" width="4.5" height="7" rx="2.25" fill="#0A0E12" />
      <rect x="13.75" y="13" width="4.5" height="12" rx="2.25" fill="#0A0E12" />
      <rect x="20" y="8" width="4.5" height="17" rx="2.25" fill="#0A0E12" />
    </svg>
  )
}

// Marca completa (símbolo + nome). "AM" em destaque, "planejador" no texto
// normal. `sub` mostra uma segunda linha menor abaixo do nome (ex: subdomínio).
export default function Logo({ size = 26, textoTamanho = "text-[15px]", sub = null, className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <div className="leading-none">
        <div className={`font-display font-semibold tracking-tight ${textoTamanho}`}>
          <span className="text-accent">AM</span>
          <span className="text-text">planejador</span>
        </div>
        {sub && <div className="text-[11px] text-text-faint font-mono mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}
