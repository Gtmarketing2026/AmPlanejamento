import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import { useClientes } from "../../hooks/useClientes"
import { crmMock as m } from "../../mocks/crm.mock"
import { iniciais } from "../../lib/format"

export default function CrmPage() {
  const { data: clientes } = useClientes()
  const cliente = clientes?.[0]

  return (
    <Stage
      eyebrow="Etapa 06"
      title="CRM do profissional"
      description="Histórico de relacionamento com cada cliente. Perfil/timeline abaixo são ilustrativos — CRM ainda não tem rota de API."
    >
      <div className="grid grid-cols-[1fr_1.4fr] gap-6">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Perfil</div>
          {cliente ? (
            <>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-full bg-panel border border-line flex items-center justify-center text-[12px] font-mono">
                  {iniciais(cliente.nome)}
                </div>
                <div>
                  <div className="font-medium">{cliente.nome}</div>
                  <div className="text-text-faint text-[11.5px]">
                    Cliente desde {cliente.data_cadastro?.split("-").reverse().join("/")}
                  </div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {[
                  ["Perfil comportamental", m.perfil.perfilComportamental],
                  ["Objetivo principal", m.perfil.objetivoPrincipal],
                  ["Última interação", m.perfil.ultimaInteracao],
                  ["Próximo follow-up", m.perfil.proximoFollowUp],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[12.5px]">
                    <span className="text-text-dim">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
              <Card className="mb-4 flex items-center justify-between">
                <span className="text-[12.5px] flex items-center gap-1.5">📅 Google Agenda</span>
                <Pill variant="on">ativo</Pill>
              </Card>
              <div className="flex flex-col gap-2">
                <Button>+ Registrar interação</Button>
                <Button variant="ghost">+ Agendar follow-up</Button>
              </div>
            </>
          ) : (
            <p className="text-text-faint text-sm">Cadastre um cliente pra ver o perfil de CRM.</p>
          )}
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">Linha do tempo</div>
          <div className="space-y-4">
            {m.timeline.map((item, i) => (
              <div key={i} className="pb-4 border-b border-line last:border-0 last:pb-0">
                <div className="font-medium text-[13px] mb-1">{item.titulo}</div>
                <p className="text-text-dim text-[12.5px] leading-relaxed mb-1.5">{item.descricao}</p>
                <div className="text-text-faint text-[11px] font-mono">{item.data}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Stage>
  )
}
