import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { abrirPainelCliente } from "../../api/clientes"
import { setTokenCliente } from "../clienteFinal/ClienteLoginPage"
import { iniciarImpersonacao } from "../../lib/impersonacao"

// A antiga tela mockada ("Etapa 04", dado ilustrativo) foi aposentada. Qualquer
// acesso a /dashboard/:clienteId agora abre o PAINEL REAL e completo do cliente
// (mesma SPA que o cliente usa), via token escopado + impersonação de origem
// "planejador". Assim não há mais como cair no mock, nem por URL/bookmark.
export default function DashboardPage() {
  const { clienteId } = useParams()
  const navigate = useNavigate()
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let cancelado = false
    async function abrir() {
      if (!clienteId) {
        navigate("/clientes", { replace: true })
        return
      }
      try {
        const { access_token } = await abrirPainelCliente(clienteId)
        if (cancelado) return
        setTokenCliente(access_token)
        iniciarImpersonacao("cliente", "planejador")
        navigate("/cliente/dashboard", { replace: true })
      } catch (e) {
        if (!cancelado) setErro(e.message || "Não foi possível abrir o painel do cliente.")
      }
    }
    abrir()
    return () => {
      cancelado = true
    }
  }, [clienteId, navigate])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      {erro ? (
        <div className="text-center">
          <p className="text-red text-sm mb-3">{erro}</p>
          <button onClick={() => navigate("/clientes")} className="text-accent text-[13px] hover:underline">
            ← Voltar aos meus clientes
          </button>
        </div>
      ) : (
        <p className="text-text-faint text-sm">Abrindo o painel do cliente…</p>
      )}
    </div>
  )
}
