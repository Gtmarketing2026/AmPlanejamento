import { useNavigate } from "react-router-dom"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import { StaticField } from "../../components/ui/Field"
import { useAuth } from "../../context/AuthContext"

const PASSOS = [
  { n: "01", label: "Dados", done: true },
  { n: "02", label: "Plano", done: true },
  { n: "03", label: "Pagamento", done: true },
  { n: "04", label: "Marca própria", done: false },
]

export default function OnboardingPage() {
  const { profissional } = useAuth()
  const navigate = useNavigate()

  return (
    <Stage eyebrow="Passo a passo" title="Onboarding do profissional" description="Do cadastro até o primeiro cliente conectado — em etapas.">
      <div className="flex gap-1 mb-2 max-w-lg">
        {PASSOS.map((p) => (
          <div
            key={p.n}
            className={`flex-1 h-1.5 rounded-full ${p.done ? "bg-accent" : "bg-amber"}`}
          />
        ))}
      </div>
      <div className="flex justify-between max-w-lg mb-8 font-mono text-[11px]">
        {PASSOS.map((p) => (
          <span key={p.n} className={p.done ? "text-accent" : "text-amber"}>
            {p.n} {p.label}
          </span>
        ))}
      </div>

      <Card className="max-w-md">
        <div className="font-display font-semibold text-lg mb-1">Personalize sua área de clientes</div>
        <p className="text-text-dim text-[13px] mb-5">Última etapa — isso é o que seus clientes vão ver.</p>
        <StaticField label="Seu subdomínio">
          app.<span className="text-accent">{profissional?.subdominio}</span>.fluxo.com.br
        </StaticField>
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={() => navigate("/clientes")}>Concluir e ir para meus clientes</Button>
          <Button variant="ghost" onClick={() => navigate("/inicio")}>
            Pular por agora
          </Button>
        </div>
      </Card>
    </Stage>
  )
}
