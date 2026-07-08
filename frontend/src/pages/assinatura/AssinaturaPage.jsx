import { useState } from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import Button from "../../components/ui/Button"
import Field from "../../components/ui/Field"
import { useAuth } from "../../context/AuthContext"
import { catalogoPlanos, escolherPlano, minhaAssinatura } from "../../api/assinatura"
import { formatarMoeda } from "../../lib/format"

const BENEFICIOS = {
  essencial: ["Upload manual de extrato/fatura (OFX, CSV, PDF)", "Classificação automática por IA", "Até 4 clientes inclusos"],
  completo: ["Tudo do Essencial", "Conciliação via Open Finance", "Marca própria (cor e logo)", "Até 4 clientes inclusos"],
}

export default function AssinaturaPage() {
  const { recarregar } = useAuth()
  const qc = useQueryClient()
  const { data: assinatura, isLoading } = useQuery({ queryKey: ["assinatura-eu"], queryFn: minhaAssinatura })
  const { data: planos } = useQuery({ queryKey: ["planos"], queryFn: catalogoPlanos })

  const [cpf, setCpf] = useState("")
  const [tipoEscolhido, setTipoEscolhido] = useState(null)

  const escolher = useMutation({
    mutationFn: ({ tipo, cpf }) => escolherPlano(tipo, cpf),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["assinatura-eu"] })
      recarregar()
      if (resp.invoice_url) window.location.href = resp.invoice_url // leva pro pagamento Asaas
    },
  })

  async function jaPaguei() {
    await Promise.all([qc.invalidateQueries({ queryKey: ["assinatura-eu"] }), recarregar()])
  }

  if (isLoading) {
    return (
      <Stage eyebrow="Assinatura" title="Seu plano">
        <p className="text-text-faint text-sm">Carregando…</p>
      </Stage>
    )
  }

  // --- 1. Já tem plano ativo (pago ou trial): mostra status + upgrade ---
  if (assinatura?.plano_ativo) {
    const podeUpgrade = assinatura.tipo_plano === "essencial"
    return (
      <Stage eyebrow="Assinatura" title="Seu plano" description="Plano ativo. A cobrança é recorrente e gerada a cada ciclo.">
        <Card className="max-w-lg mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-semibold text-lg">{assinatura.nome_plano}</span>
            <Pill variant="on" pulse>ativo</Pill>
          </div>
          <div className="text-text-dim text-[13px]">{formatarMoeda(assinatura.valor_base)} / mês</div>
          <Link to="/faturas" className="inline-block mt-4 text-accent text-[12.5px] hover:underline">
            Ver histórico de faturas →
          </Link>
        </Card>

        {podeUpgrade && (
          <Card className="max-w-lg" style={{ borderColor: "rgba(76,141,255,0.3)" }}>
            <div className="text-[11px] text-blue uppercase tracking-wide font-mono mb-2">Upgrade disponível</div>
            <p className="text-text-dim text-[13px] mb-3">
              Suba pro <strong className="text-text">Plano Completo</strong> pra habilitar Open Finance e marca própria.
            </p>
            <Button
              variant="ghost"
              disabled={escolher.isPending}
              onClick={() => escolher.mutate({ tipo: "completo", cpf: "" })}
            >
              {escolher.isPending ? "Processando…" : "Fazer upgrade"}
            </Button>
          </Card>
        )}
      </Stage>
    )
  }

  // --- 2. Já escolheu plano mas pagamento pendente ---
  if (assinatura?.tem_assinatura) {
    return (
      <Stage eyebrow="Assinatura" title="Aguardando pagamento" description="Sua conta libera assim que o pagamento for confirmado.">
        <Card className="max-w-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="font-display font-semibold">{assinatura.nome_plano}</span>
            <Pill variant="warn">pagamento pendente</Pill>
          </div>
          <p className="text-text-dim text-[13px] mb-4">
            {formatarMoeda(assinatura.valor_base)} / mês. Pague via Pix, boleto ou cartão no link do Asaas.
          </p>
          <div className="flex items-center gap-3">
            {assinatura.invoice_url && (
              <a href={assinatura.invoice_url} target="_blank" rel="noreferrer">
                <Button>Ir para o pagamento →</Button>
              </a>
            )}
            <Button variant="ghost" onClick={jaPaguei}>
              Já paguei — atualizar
            </Button>
          </div>
        </Card>
      </Stage>
    )
  }

  // --- 3. Ainda sem plano: escolher ---
  return (
    <Stage
      eyebrow="Assinatura"
      title="Escolha seu plano"
      description="Você já está cadastrado. Escolha um plano e pague pra ativar sua conta e começar a cadastrar clientes."
    >
      <div className="grid grid-cols-2 gap-5 max-w-3xl">
        {planos?.map((p) => {
          const selecionado = tipoEscolhido === p.tipo_plano
          return (
            <Card
              key={p.tipo_plano}
              accent={selecionado}
              className={`cursor-pointer ${selecionado ? "" : "hover:border-text-faint"}`}
            >
              <button type="button" onClick={() => setTipoEscolhido(p.tipo_plano)} className="text-left w-full">
                <div className="font-display font-semibold text-lg mb-1">{p.nome}</div>
                <div className="text-accent font-mono text-xl mb-3">
                  {formatarMoeda(p.valor_base)}<span className="text-text-faint text-[12px]"> /mês</span>
                </div>
                <ul className="space-y-1.5 text-[12.5px] text-text-dim">
                  {BENEFICIOS[p.tipo_plano].map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-accent">✓</span> {b}
                    </li>
                  ))}
                </ul>
                <div className="text-text-faint text-[11px] mt-3">
                  Cliente extra (5º+): {formatarMoeda(p.valor_por_extra)}/mês
                </div>
              </button>
            </Card>
          )
        })}
      </div>

      {tipoEscolhido && (
        <Card className="mt-5 max-w-md">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-2">
            Confirmar {planos?.find((p) => p.tipo_plano === tipoEscolhido)?.nome}
          </div>
          <Field
            label="CPF ou CNPJ (para a cobrança)"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="somente números"
          />
          {escolher.isError && <p className="text-red text-[12.5px] mb-2">{escolher.error.message}</p>}
          <Button disabled={!cpf || escolher.isPending} onClick={() => escolher.mutate({ tipo: tipoEscolhido, cpf })}>
            {escolher.isPending ? "Gerando cobrança…" : "Ir para o pagamento →"}
          </Button>
        </Card>
      )}
    </Stage>
  )
}
