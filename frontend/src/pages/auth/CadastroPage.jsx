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
  const [form, setForm] = useState({
    nome: "",
    nome_empresa: "",
    email: "",
    whatsapp: "",
    senha: "",
    confirmarSenha: "",
  })
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function set(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setErro(null)
    if (form.senha !== form.confirmarSenha) {
      setErro("As senhas não conferem.")
      return
    }
    if (form.senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.")
      return
    }
    setEnviando(true)
    try {
      await cadastrar(form.nome, form.email, form.senha, {
        nome_empresa: form.nome_empresa || null,
        whatsapp: form.whatsapp ? form.whatsapp.replace(/\D/g, "") : null,
      })
      // Recém-cadastrado entra em trial de 7 dias -> já consegue usar o produto.
      navigate("/clientes")
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível cadastrar.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <span className="font-mono text-[11px] text-accent uppercase tracking-wide">Etapa 01</span>
      <h1 className="font-display text-xl font-semibold mt-1 mb-1">Crie sua conta de planejador</h1>
      <p className="text-text-dim text-sm mb-5">
        Teste grátis por 7 dias. Sem cartão para começar — o plano base já inclui até 4 clientes.
      </p>
      <form onSubmit={onSubmit}>
        <Field label="Nome completo" value={form.nome} onChange={set("nome")} required />
        <Field
          label="Nome da empresa / escritório"
          placeholder="Se você atua como autônomo, use seu próprio nome"
          value={form.nome_empresa}
          onChange={set("nome_empresa")}
        />
        <Field
          label="E-mail profissional"
          type="email"
          value={form.email}
          onChange={set("email")}
          required
        />
        <Field
          label="WhatsApp"
          placeholder="DDD + número (apenas números)"
          value={form.whatsapp}
          onChange={set("whatsapp")}
          inputMode="numeric"
        />
        <Field
          label="Senha"
          type="password"
          placeholder="Mínimo 8 caracteres"
          value={form.senha}
          onChange={set("senha")}
          required
        />
        <Field
          label="Confirmar senha"
          type="password"
          value={form.confirmarSenha}
          onChange={set("confirmarSenha")}
          required
        />
        {erro && <p className="text-red text-[12.5px] mb-3">{erro}</p>}
        <Button type="submit" block disabled={enviando}>
          {enviando ? "Criando conta…" : "Criar conta"}
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
