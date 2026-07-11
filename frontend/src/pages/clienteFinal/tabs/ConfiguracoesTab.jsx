import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import Field from "../../../components/ui/Field"
import { obterMinhasPreferencias, atualizarMinhasPreferencias, listarMinhasContas } from "../../../api/contas"
import { atualizarMeuConjuge, meuPerfilCliente } from "../../../api/clientes"

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
  const { data: perfil } = useQuery({
    queryKey: ["cliente-eu", token],
    queryFn: () => meuPerfilCliente(token),
    enabled: !!token,
  })

  // Cônjuge (cadastro simples)
  const [conjuge, setConjuge] = useState("")
  const [conjugeSalvo, setConjugeSalvo] = useState(false)
  useEffect(() => {
    if (perfil) setConjuge(perfil.conjuge_nome || "")
  }, [perfil])
  const salvarConjuge = useMutation({
    mutationFn: () => atualizarMeuConjuge(token, conjuge.trim() || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu", token] })
      setConjugeSalvo(true)
      setTimeout(() => setConjugeSalvo(false), 2500)
    },
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
        <div className="text-[14px] font-medium mb-1">Cônjuge</div>
        <p className="text-text-dim text-[12.5px] mb-3">
          Cadastre seu cônjuge para separar as contas e cartões dele(a) das suas (marque na aba <strong>Contas</strong>).
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvarConjuge.mutate()
          }}
          className="flex items-end gap-3 flex-wrap"
        >
          <div className="w-64">
            <Field
              label="Nome do cônjuge"
              value={conjuge}
              onChange={(e) => setConjuge(e.target.value)}
              placeholder="ex: Maria Silva (deixe vazio para remover)"
            />
          </div>
          <Button type="submit" disabled={salvarConjuge.isPending} className="mb-0.5">
            {salvarConjuge.isPending ? "Salvando…" : "Salvar"}
          </Button>
          {conjugeSalvo && <span className="text-accent text-[12.5px] mb-2.5">Salvo.</span>}
        </form>
      </Card>

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
              Se o seu cartão vira (fecha) todo dia 19, o seu "mês" de cartão vai do dia 20 ao dia 19 do mês seguinte.
              Assim, tanto uma compra de 25/06 quanto uma de 10/07 contam como gasto de <strong>junho</strong> — porque
              estão no mesmo ciclo (o que abriu em junho, o mês do consumo). Você enxerga quanto gastou por ciclo do
              cartão, não pelo mês-calendário de cada compra. A data da compra continua aparecendo igual nos
              lançamentos; só muda em qual mês ela é somada.
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
