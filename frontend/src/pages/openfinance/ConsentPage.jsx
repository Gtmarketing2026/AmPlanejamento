import Stage from "../../components/layout/Stage"
import PhoneFrame from "../../components/ui/PhoneFrame"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import LockedOverlay from "../../components/ui/LockedOverlay"
import { usePlan } from "../../context/PlanContext"
import { openFinanceMock as m } from "../../mocks/openFinance.mock"

export default function ConsentPage() {
  const { plano } = usePlan()
  const bloqueado = plano === "essencial"

  return (
    <Stage
      eyebrow="Etapa 03"
      title="Cliente final autoriza o Open Finance"
      description="Fluxo mobile, sem intermediário do profissional — regulado pelo Banco Central. Prévia de como o cliente final vê essa tela (dado ilustrativo, ainda não conectado ao backend)."
    >
      <div className="relative">
        {bloqueado && (
          <LockedOverlay description="Conciliação automática via Open Finance não está incluída no Plano Essencial." />
        )}
        <PhoneFrame>
          <div className="text-center">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-blue mx-auto mb-4" />
            <div className="font-display font-semibold text-lg mb-1">{m.clienteNome}, conecte suas contas</div>
            <p className="text-text-dim text-[12.5px] mb-1">
              {m.planejadorNome} (sua planejadora) vai acompanhar seus dados financeiros.
            </p>
            <p className="text-text-faint text-[11px] font-mono mb-5">app.{m.subdominio}.fluxo.com.br</p>

            <Card className="mb-3 text-left">
              <div className="font-medium text-[13px] mb-1">Banco selecionado</div>
              <p className="text-text-dim text-[12px]">
                Você será redirecionado para autenticar diretamente no seu banco.
              </p>
            </Card>

            <Card accent className="mb-3 text-left">
              <div className="text-[13px] mb-1">🔒 Só leitura, nunca movimentação</div>
              <p className="text-text-dim text-[12px]">Fluxo apenas lê seus dados — nunca faz transações.</p>
            </Card>

            <Card className="mb-4 text-left">
              <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">
                Você está autorizando
              </div>
              <ul className="space-y-1.5">
                {m.permissoes.map((p) => (
                  <li key={p} className="text-[12px] text-text-dim flex gap-1.5">
                    <span className="text-accent">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </Card>

            <Button block>Autorizar no meu banco</Button>
            <p className="text-text-faint text-[10.5px] font-mono mt-4">
              Powered by Open Finance · regulado pelo Bacen
            </p>
          </div>
        </PhoneFrame>
      </div>
    </Stage>
  )
}
