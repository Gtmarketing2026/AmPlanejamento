import Button from "./Button"

export default function LockedOverlay({ title = "Exclusivo do Plano Completo", description }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center gap-3 bg-bg/90 backdrop-blur-sm rounded-2xl px-8">
      <span className="text-3xl">🔒</span>
      <div className="font-display font-semibold text-lg">{title}</div>
      {description && <p className="text-text-dim text-sm max-w-sm">{description}</p>}
      <Button variant="primary" className="mt-2">Fazer upgrade do plano</Button>
    </div>
  )
}
