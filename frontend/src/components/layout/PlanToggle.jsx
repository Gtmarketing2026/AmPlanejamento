import { usePlan } from "../../context/PlanContext"

export default function PlanToggle() {
  const { plano, setPlano } = usePlan()

  return (
    <div className="inline-flex gap-1 bg-panel border border-line rounded-[10px] p-1">
      {[
        { value: "essencial", label: "Plano Essencial" },
        { value: "completo", label: "Plano Completo" },
      ].map((opt) => (
        <button
          key={opt.value}
          onClick={() => setPlano(opt.value)}
          className={`px-3 py-1.5 rounded-[7px] text-[11.5px] font-semibold transition-colors ${
            plano === opt.value ? "bg-accent text-[#062019]" : "text-text-dim hover:text-text"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
