import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { loginCliente } from "../../api/clientes"
import { ApiError } from "../../api/client"

export function setTokenCliente(token) {
  if (token) localStorage.setItem("fluxo_cliente_token", token)
  else localStorage.removeItem("fluxo_cliente_token")
}

export function getTokenCliente() {
  return localStorage.getItem("fluxo_cliente_token")
}

export default function ClienteLoginPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const { access_token } = await loginCliente(nickname, senha)
      setTokenCliente(access_token)
      navigate("/cliente/dashboard")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <h1 className="font-display text-xl font-semibold mb-1">Área do cliente</h1>
      <p className="text-text-dim text-sm mb-5">Acompanhe seu planejamento financeiro.</p>
      <form onSubmit={onSubmit}>
        <Field label="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
        <Field label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
        <Button type="submit" block disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="text-text-faint text-[11.5px] mt-4 text-center">
        Nickname e senha são fornecidos pelo seu planejador financeiro.
      </p>
    </Card>
  )
}
