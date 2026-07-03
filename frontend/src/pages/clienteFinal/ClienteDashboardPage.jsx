import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import DonutChart from "../../components/ui/DonutChart"
import BarRow from "../../components/ui/BarRow"
import { meuPerfilCliente } from "../../api/clientes"
import { ApiError } from "../../api/client"
import { dashboardMock as m } from "../../mocks/dashboard.mock"
import { getTokenCliente, setTokenCliente } from "./ClienteLoginPage"

export default function ClienteDashboardPage() {
  const navigate = useNavigate()
  const token = getTokenCliente()

  const { data: perfil, error } = useQuery({
    queryKey: ["cliente-eu", token],
    queryFn: () => meuPerfilCliente(token),
    enabled: !!token,
    retry: false,
  })

  useEffect(() => {
    if (!token || (error instanceof ApiError && error.status === 401)) {
      setTokenCliente(null)
      navigate("/cliente/login")
    }
  }, [token, error, navigate])

  function sair() {
    setTokenCliente(null)
    navigate("/cliente/login")
  }

  if (!token || !perfil) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-text-dim">Carregando…</div>
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="sticky top-0 z-40 bg-bg/92 backdrop-blur border-b border-line px-8 py-[18px] flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold">Olá, {perfil.nome.split(" ")[0]}</div>
          <div className="text-[11px] text-text-faint font-mono">
            visão só de leitura — fale com seu planejador pra fazer mudanças
          </div>
        </div>
        <button onClick={sair} className="px-3 py-2 rounded-[7px] text-[12.5px] text-text-faint hover:text-text-dim">
          Sair
        </button>
      </div>

      <div className="max-w-[900px] mx-auto px-8 py-10">
        <Card accent className="mb-5">
          <div className="flex items-center gap-4">
            <DonutChart pct={m.saudeFinanceira.pct} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold">Saúde financeira: {m.saudeFinanceira.status}</span>
                <Pill variant="on">reserva OK</Pill>
              </div>
              <p className="text-text-dim text-[12.5px] mt-1">
                Reserva de emergência cobre {m.saudeFinanceira.reservaMeses} meses de gastos · taxa de
                poupança de {m.saudeFinanceira.taxaPoupanca}% no mês
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Gasto por categoria (dado ilustrativo)
          </div>
          {m.gastoPorCategoria.map((c) => (
            <BarRow key={c.label} label={c.label} pct={c.pct} value={c.valor} />
          ))}
        </Card>
      </div>
    </div>
  )
}
