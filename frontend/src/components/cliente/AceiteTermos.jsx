import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Card from "../ui/Card"
import Button from "../ui/Button"
import { aceitarTermosCliente } from "../../api/clientes"

// Porta de aceite (LGPD) no 1º acesso do cliente final: bloqueia o painel até
// ler e aceitar Termos + Privacidade. O aceite (data + versão) fica registrado.
export default function AceiteTermos({ token, nome }) {
  const qc = useQueryClient()
  const [aceite, setAceite] = useState(false)

  const salvar = useMutation({
    mutationFn: () => aceitarTermosCliente(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu", token] }),
  })

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="font-display text-[18px] font-semibold mb-1">
            {nome ? `Olá, ${nome.split(" ")[0]}!` : "Bem-vindo(a)!"}
          </h1>
          <p className="text-text-dim text-[13px] mb-4">
            Antes de acessar seu painel, precisamos do seu aceite. Seus dados são tratados conforme a LGPD.
          </p>

          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={aceite}
              onChange={(e) => setAceite(e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span className="text-text-dim text-[12.5px] leading-snug">
              Li e aceito os{" "}
              <a href="/termos" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a href="/privacidade" target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Política de Privacidade
              </a>
              .
            </span>
          </label>

          {salvar.isError && (
            <p className="text-red text-[12.5px] mb-3">Não foi possível registrar o aceite. Tente de novo.</p>
          )}
          <Button block disabled={!aceite || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? "Salvando…" : "Aceitar e continuar"}
          </Button>
        </Card>
      </div>
    </div>
  )
}
