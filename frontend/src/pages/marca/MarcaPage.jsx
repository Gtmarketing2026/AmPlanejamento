import { useState } from "react"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field, { Label } from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import PhoneFrame from "../../components/ui/PhoneFrame"
import LockedOverlay from "../../components/ui/LockedOverlay"
import Pill from "../../components/ui/Pill"
import { useAuth } from "../../context/AuthContext"
import { atualizarMarca } from "../../api/marca"
import { ApiError } from "../../api/client"

const CORES = ["#26D9A8", "#4C8DFF", "#F0A63C", "#E5645A", "#8B5CF6", "#EC4899"]

export default function MarcaPage() {
  const { profissional, recarregar } = useAuth()
  const bloqueado = !profissional?.pode_editar_marca

  const [form, setForm] = useState({
    nome_empresa: profissional?.nome_empresa || "",
    cor_marca: profissional?.cor_marca || "#26D9A8",
    subdominio: profissional?.subdominio || "",
    video_boas_vindas: profissional?.video_boas_vindas || "",
  })
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function onSalvar(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await atualizarMarca({
        nome_empresa: form.nome_empresa || null,
        cor_marca: form.cor_marca,
        subdominio: form.subdominio || null,
        video_boas_vindas: form.video_boas_vindas || null,
      })
      await recarregar()
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar.")
    } finally {
      setEnviando(false)
    }
  }

  const nomeExibido = form.nome_empresa || profissional?.nome || "Seu escritório"

  return (
    <Stage
      eyebrow="Configurações"
      title="Marca própria (white-label)"
      description="Personalize o app que seus clientes veem. As mudanças aparecem no próximo acesso deles."
    >
      <div className="relative grid grid-cols-[1fr_320px] gap-7 max-md:grid-cols-1">
        {bloqueado && (
          <LockedOverlay description="Marca própria (subdomínio, cor e vídeo) está disponível no Plano Completo." />
        )}
        <form onSubmit={onSalvar}>
          <Field
            label="Nome exibido pro cliente"
            value={form.nome_empresa}
            onChange={set("nome_empresa")}
            placeholder="ex: GT Marketing / Seu escritório"
            disabled={bloqueado}
          />

          <div className="mb-3">
            <Label>Cor de marca</Label>
            <div className="flex items-center gap-2">
              {CORES.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setForm((f) => ({ ...f, cor_marca: cor }))}
                  style={{ background: cor }}
                  className={`w-[30px] h-[30px] rounded-lg border-2 ${
                    form.cor_marca?.toLowerCase() === cor.toLowerCase() ? "border-text" : "border-transparent"
                  }`}
                />
              ))}
              <input
                type="color"
                value={form.cor_marca}
                onChange={set("cor_marca")}
                disabled={bloqueado}
                className="w-[30px] h-[30px] rounded-lg bg-transparent border border-line cursor-pointer"
                title="Cor personalizada"
              />
              <span className="text-text-faint text-[12px] font-mono ml-1">{form.cor_marca}</span>
            </div>
          </div>

          <div className="mb-3">
            <Label>Identificador do escritório (endereço próprio)</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-text-faint text-[13px] font-mono">app.</span>
              <input
                value={form.subdominio}
                onChange={(e) => setForm((f) => ({ ...f, subdominio: e.target.value.toLowerCase() }))}
                disabled={bloqueado}
                className="bg-bg border border-line rounded-[9px] px-3 py-2.5 text-[13.5px] text-text outline-none focus:border-accent/60 w-40 disabled:opacity-60"
              />
              <span className="text-text-faint text-[13px] font-mono">.…</span>
            </div>
            <p className="text-text-faint text-[11px] mt-1">
              Apenas letras e números, sem espaços. Fica <strong>reservado</strong> pra virar o endereço próprio do seu
              painel quando o domínio personalizado for ativado (em breve). Hoje o acesso é pelo endereço padrão do
              AMplanejador.
            </p>
          </div>

          <Field
            label="Vídeo de boas-vindas (YouTube)"
            value={form.video_boas_vindas}
            onChange={set("video_boas_vindas")}
            placeholder="https://youtube.com/watch?v=..."
            disabled={bloqueado}
          />

          <div className="mb-4 opacity-60">
            <Label>Logo</Label>
            <div className="text-text-faint text-[12px]">
              Upload de logo entra numa próxima atualização.
            </div>
          </div>

          {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={bloqueado || enviando}>
              {enviando ? "Salvando…" : "Salvar alterações"}
            </Button>
            {salvo && <Pill variant="on">salvo</Pill>}
          </div>
        </form>

        <div>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">
            Pré-visualização — o que o cliente vê
          </div>
          <PhoneFrame width={280}>
            <div className="text-center">
              <div className="w-9 h-9 rounded-lg mx-auto mb-3" style={{ background: form.cor_marca }} />
              <div className="font-semibold text-[12.5px]">{nomeExibido}</div>
              <div className="text-text-faint text-[9.5px] font-mono mb-4">
                app.{form.subdominio || profissional?.subdominio}
              </div>
              <Card className="mb-3 text-left p-3">
                <div className="text-[10px] text-text-faint mb-1">SALDO CONCILIADO</div>
                <div className="text-[16px] font-semibold" style={{ color: form.cor_marca }}>
                  R$ 2.425
                </div>
              </Card>
              <Card className="text-left p-3">
                <div className="text-[10px] text-text-faint mb-1.5">META: SAIR DO ALUGUEL</div>
                <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: "71%", background: form.cor_marca }}
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
