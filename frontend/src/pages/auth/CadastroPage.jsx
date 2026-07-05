import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { useAuth } from "../../context/AuthContext"
import { ApiError } from "../../api/client"

export default function CadastroPage() {
  const { cadastrar } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: "", email: "", senha: "", subdominio: "" })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      await cadastrar(form.nome, form.email, form.senha, form.subdominio)
      // Recém-cadastrado ainda não tem plano -> vai direto escolher/pagar.
      navigate("/assinatura")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível cadastrar.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <span className="font-mono text-[11px] text-accent uppercase tracking-wide">Etapa 01</span>
      <h1 className="font-display text-xl font-semibold mt-1 mb-1">Cadastro do profissional</h1>
      <p className="text-text-dim text-sm mb-5">
        O plano base já inclui até 4 clientes geridos.
      </p>
      <form onSubmit={onSubmit}>
        <Field label="Nome completo" value={form.nome} onChange={set("nome")} required />
        <Field label="E-mail profissional" type="email" value={form.email} onChange={set("email")} required />
        <Field
          label="Subdomínio"
          placeholder="ex: renatasouza"
          value={form.subdominio}
          onChange={set("subdominio")}
          required
        />
        <Field label="Senha" type="password" value={form.senha} onChange={set("senha")} required />
        {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
        <Button type="submit" block disabled={enviando}>
          {enviando ? "Criando conta…" : "Confirmar cadastro"}
        </Button>
      </form>
      <p className="text-text-faint text-[12.5px] mt-4 text-center">
        Já tem conta?{" "}
        <Link to="/login" className="text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </Card>
  )
}
