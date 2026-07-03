const VARIANTS = {
  primary: "bg-accent text-[#062019] hover:brightness-110",
  ghost: "bg-transparent border border-line text-text-dim hover:text-text hover:border-text-faint",
}

export default function Button({
  variant = "primary",
  block = false,
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[9px] font-semibold text-[13.5px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        VARIANTS[variant]
      } ${block ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
