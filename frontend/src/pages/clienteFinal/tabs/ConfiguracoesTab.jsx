import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import { obterMinhasPreferencias, atualizarMinhasPreferencias, listarMinhasContas } from "../../../api/contas"

export default function ConfiguracoesTab({ token }) {
  const qc = useQueryClient()
  const [salvo, setSalvo] = useState(false)

  const { data: pref, isLoading } = useQuery({
    queryKey: ["cliente-eu-preferencias", token],
    queryFn: () => obterMinhasPreferencias(token),
    enabled: !!token,
  })
  const { data: contas = [] } = useQuery({
    queryKey: ["cliente-eu-contas", token],
    queryFn: () => listarMinhasContas(token),
    enabled: !!token,
  })

  const salvar = useMutation({
    mutationFn: (visualizacao_lancamento) => atualizarMinhasPreferencias(token, { visualizacao_lancamento }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-preferencias", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-contas", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
    },
  })

  const cartoesSemVirada = contas.filter((c) => c.natureza === "cartao" && !c.dia_virada)

  if (isLoading || !pref) return <p className="text-text-faint text-sm">Carregando…</p>

  const atual = pref.visualizacao_lancamento

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="text-[14px] font-medium mb-1">Como contar seus gastos de cartão</div>
        <p className="text-text-dim text-[12.5px] mb-4">
          Define em qual mês uma compra no cartão de crédito entra na sua visão de gastos.
        </p>

        <label
          className={`flex gap-3 border rounded-[9px] px-3.5 py-3 mb-2.5 cursor-pointer ${
            atual === "data_compra" ? "border-accent/60 bg-panel-2" : "border-line"
          }`}
        >
          <input
            type="radio"
            className="mt-1 accent-accent"
            checked={atual === "data_compra"}
            onChange={() => salvar.mutate("data_compra")}
          />
          <div>
            <div className="text-[13.5px] font-medium">Data da compra (padrão)</div>
            <div className="text-text-dim text-[12px] mt-0.5">
              Cada compra conta pro mês calendário em que ela foi feita. Simples e direto.
            </div>
          </div>
        </label>

        <label
          className={`flex gap-3 border rounded-[9px] px-3.5 py-3 cursor-pointer ${
            atual === "virada_cartao" ? "border-accent/60 bg-panel-2" : "border-line"
          }`}
        >
          <input
            type="radio"
            className="mt-1 accent-accent"
            checked={atual === "virada_cartao"}
            onChange={() => salvar.mutate("virada_cartao")}
          />
          <div>
            <div className="text-[13.5px] font-medium">Virada do cartão</div>
            <div className="text-text-dim text-[12px] mt-0.5">
              Se o seu cartão fecha todo dia 19, uma compra feita em 25/06 conta como gasto de julho, não de junho —
              porque o seu "mês" vai de 19 a 18, não de 1 a 31. Assim você enxerga quanto gastou por mês de verdade,
              não só o que caiu em cada fatura. A data de compra continua aparecendo igual nos lançamentos; só o mês
              em que ela é somada muda.
            </div>
            {atual === "virada_cartao" && cartoesSemVirada.length > 0 && (
              <div className="text-amber text-[11.5px] mt-2">
                {cartoesSemVirada.map((c) => c.nome_exibicao).join(", ")} sem dia de virada cadastrado — configure em{" "}
                <strong>Contas</strong> pra essa regra valer pra {cartoesSemVirada.length > 1 ? "eles" : "ele"}.
              </div>
            )}
          </div>
        </label>

        {salvo && <p className="text-accent text-[12.5px] mt-3">Preferência salva.</p>}
      </Card>
    </div>
  )
}
