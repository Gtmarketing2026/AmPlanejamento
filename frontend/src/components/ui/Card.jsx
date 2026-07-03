export default function Card({ children, className = "", accent = false, ...props }) {
  return (
    <div
      className={`bg-panel-2 border rounded-xl p-[18px] ${
        accent ? "border-accent/40" : "border-line"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
