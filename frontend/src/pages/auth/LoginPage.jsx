import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { useAuth } from "../../context/AuthContext"
import { ApiError } from "../../api/client"

export default function LoginPage() {
  const { entrar } = useAuth()
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
      await entrar(email, senha)
      navigate("/clientes")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <h1 className="font-display text-xl font-semibold mb-1">Entrar</h1>
      <p className="text-text-dim text-sm mb-5">Acesse sua conta de profissional.</p>
      <form onSubmit={onSubmit}>
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Field
          label="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
        <Button type="submit" block disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <p className="text-text-faint text-[12.5px] mt-4 text-center">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="text-accent hover:underline">
          Cadastre-se
        </Link>
      </p>
      <p className="text-text-faint text-[11.5px] mt-2 text-center">
        <Link to="/negocio/login" className="hover:text-text-dim">
          Acesso do administrador
        </Link>
      </p>
    </Card>
  )
}
