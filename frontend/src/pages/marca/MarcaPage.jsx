import { useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field, { StaticField } from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import PhoneFrame from "../../components/ui/PhoneFrame"
import LockedOverlay from "../../components/ui/LockedOverlay"
import Pill from "../../components/ui/Pill"
import { useAuth } from "../../context/AuthContext"
import { whiteLabelMock as m } from "../../mocks/whiteLabel.mock"

export default function MarcaPage() {
  const { profissional } = useAuth()
  const bloqueado = profissional?.tipo_plano !== "completo"
  const [nomeExibido, setNomeExibido] = useState(profissional?.nome || "")
  const [corSelecionada, setCorSelecionada] = useState(m.cores[0])
  const [salvo, setSalvo] = useState(false)

  function onSalvar(e) {
    e.preventDefault()
    // MOCK: nao existe PATCH /profissionais/marca ainda -- so-op de demonstracao.
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <Stage
      eyebrow="Configurações"
      title="Marca própria (white-label)"
      description="Ajustável a qualquer momento — o cliente final vê a mudança na próxima vez que acessar. Salvar aqui é ilustrativo, ainda sem rota de API."
    >
      <div className="relative grid grid-cols-[1fr_320px] gap-7">
        {bloqueado && (
          <LockedOverlay description="Marca própria (subdomínio, cor e logo) não está incluída no Plano Essencial." />
        )}
        <form onSubmit={onSalvar}>
          <StaticField label="Subdomínio">
            app.<span className="text-accent">{profissional?.subdominio}</span>.fluxo.com.br
          </StaticField>
          <Field label="Nome exibido pro cliente" value={nomeExibido} onChange={(e) => setNomeExibido(e.target.value)} />
          <div className="mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">Cor de marca</div>
            <div className="flex gap-2">
              {m.cores.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setCorSelecionada(cor)}
                  style={{ background: cor }}
                  className={`w-[30px] h-[30px] rounded-lg border-2 ${
                    corSelecionada === cor ? "border-text" : "border-transparent"
                  }`}
                />
              ))}
              <button
                type="button"
                className="w-[30px] h-[30px] rounded-lg border-2 border-dashed border-line text-text-faint text-sm"
              >
                +
              </button>
            </div>
          </div>
          <Field label="Logo" placeholder="Enviar logo (PNG/SVG)" disabled />
          <div className="flex items-center gap-3 mt-3">
            <Button type="submit">Salvar alterações</Button>
            {salvo && <Pill variant="on">alterações salvas (demo)</Pill>}
          </div>
        </form>

        <div>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">
            Pré-visualização — o que o cliente vê
          </div>
          <PhoneFrame width={280}>
            <div className="text-center">
              <div
                className="w-9 h-9 rounded-lg mx-auto mb-3"
                style={{ background: corSelecionada }}
              />
              <div className="font-semibold text-[12.5px]">{nomeExibido || "Seu nome"}</div>
              <div className="text-text-faint text-[9.5px] font-mono mb-4">
                app.{profissional?.subdominio}.fluxo.com.br
              </div>
              <Card className="mb-3 text-left p-3">
                <div className="text-[10px] text-text-faint mb-1">SALDO CONCILIADO</div>
                <div className="text-[16px] font-semibold" style={{ color: corSelecionada }}>
                  R$ 2.425
                </div>
              </Card>
              <Card className="text-left p-3">
                <div className="text-[10px] text-text-faint mb-1.5">META: SAIR DO ALUGUEL</div>
                <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: "71%", background: `linear-gradient(90deg, ${corSelecionada}, var(--color-accent))` }}
                  />
                </div>
              </Card>
            </div>
          </PhoneFrame>
        </div>
      </div>
    </Stage>
  )
}
