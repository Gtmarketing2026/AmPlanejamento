import { Link } from "react-router-dom"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import { useAuth } from "../../context/AuthContext"
import { useClientes } from "../../hooks/useClientes"

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

function diasRestantes(trialAte) {
  if (!trialAte) return null
  const hoje = new Date(new Date().toISOString().split("T")[0] + "T00:00:00")
  const fim = new Date(trialAte + "T00:00:00")
  const dias = Math.ceil((fim - hoje) / 86400000)
  return dias >= 0 ? dias : null
}

const ACOES = [
  { to: "/clientes", icone: "👥", label: "Ver meus clientes" },
  { to: "/clientes", icone: "➕", label: "Cadastrar novo cliente" },
  { to: "/marca", icone: "🏢", label: "Configurar marca" },
  { to: "/assinatura", icone: "💳", label: "Assinatura e cobrança" },
]

export default function InicioPage() {
  const { profissional } = useAuth()
  const { data: clientes } = useClientes()

  const primeiroNome = profissional?.nome?.split(" ")[0] || ""
  const emTrial = !profissional?.tem_assinatura && !!profissional?.trial_ate
  const restam = emTrial ? diasRestantes(profissional.trial_ate) : null

  return (
    <div className="max-w-[1360px] mx-auto px-8 py-10 pb-24">
      <h1 className="font-display text-2xl font-semibold mb-1.5">
        {saudacao()}, {primeiroNome}
      </h1>
      <p className="text-text-dim text-sm mb-6">Planejar é transformar incerteza em propósito.</p>

      {emTrial && restam !== null && (
        <Card className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <Pill variant={restam <= 2 ? "warn" : "on"}>
              Trial — {restam} {restam === 1 ? "dia" : "dias"}
            </Pill>
            <span className="text-text-dim text-[13px]">
              Você está testando o Fluxo. Escolha um plano quando quiser continuar sem interrupção.
            </span>
          </div>
          <Link
            to="/assinatura"
            className="px-3.5 py-2 rounded-[7px] bg-accent text-[#062019] text-[12.5px] font-semibold hover:brightness-110"
          >
            Ver planos →
          </Link>
        </Card>
      )}

      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
        Primeiros passos
      </div>
      <div className="grid grid-cols-2 gap-3 mb-8 max-md:grid-cols-1">
        {ACOES.map((a) => (
          <Link key={a.label} to={a.to}>
            <Card className="flex items-center gap-3 hover:border-accent/40 transition-colors cursor-pointer">
              <span className="text-xl">{a.icone}</span>
              <span className="font-medium text-[13.5px]">{a.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-lg">💬</span>
          <div className="font-medium text-[13.5px]">Comunidade no WhatsApp</div>
        </div>
        <p className="text-text-dim text-[12.5px] mb-3">
          Conecte-se com outros planejadores, troque experiências e receba avisos da equipe Fluxo.
        </p>
        <span className="inline-block px-3 py-1.5 rounded-[7px] bg-panel-2 border border-line text-text-faint text-[12px]">
          Link da comunidade em breve
        </span>
      </Card>

      {clientes && clientes.length === 0 && (
        <p className="text-text-faint text-[12.5px] mt-6">
          Você ainda não tem clientes cadastrados —{" "}
          <Link to="/clientes" className="text-accent hover:underline">
            comece por aqui
          </Link>
          .
        </p>
      )}
    </div>
  )
}
