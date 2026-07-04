import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { loginAdmin, setTokenAdmin } from "../../api/negocio"
import { ApiError } from "../../api/client"

export default function NegocioLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const { access_token } = await loginAdmin(email, senha)
      setTokenAdmin(access_token)
      navigate("/negocio", { replace: true })
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <h1 className="font-display text-xl font-semibold mb-1">Acesso do administrador</h1>
      <p className="text-text-dim text-sm mb-5">Nível Negócio — visão de toda a plataforma.</p>
      <form onSubmit={onSubmit}>
        <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
        <Button type="submit" block disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Card>
  )
}
