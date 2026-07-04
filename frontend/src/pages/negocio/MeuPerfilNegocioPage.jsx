import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import { atualizarPerfilAdmin, buscarPerfilAdmin } from "../../api/negocio"

export default function MeuPerfilNegocioPage() {
  const qc = useQueryClient()
  const { data: perfil, isLoading } = useQuery({ queryKey: ["negocio-perfil"], queryFn: buscarPerfilAdmin })

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [sucesso, setSucesso] = useState(false)

  useEffect(() => {
    if (perfil) setEmail(perfil.email)
  }, [perfil])

  const atualizar = useMutation({
    mutationFn: atualizarPerfilAdmin,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negocio-perfil"] })
      setSenha("")
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    },
  })

  function onSubmit(e) {
    e.preventDefault()
    const dados = {}
    if (perfil && email !== perfil.email) dados.email = email
    if (senha) dados.senha = senha
    if (Object.keys(dados).length === 0) return
    atualizar.mutate(dados)
  }

  if (isLoading) {
    return (
      <Stage eyebrow="Nível Negócio · Admin" title="Minha conta">
        <p className="text-text-faint text-sm">Carregando…</p>
      </Stage>
    )
  }

  return (
    <Stage eyebrow="Nível Negócio · Admin" title="Minha conta" description="E-mail e senha de acesso do admin — separados do login de qualquer profissional ou cliente.">
      <Card className="max-w-md">
        <form onSubmit={onSubmit}>
          <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field
            label="Nova senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="deixe em branco pra manter a atual"
          />
          {atualizar.isError && <p className="text-red text-[12.5px] mb-3">{atualizar.error.message}</p>}
          {sucesso && <p className="text-accent text-[12.5px] mb-3">Dados atualizados.</p>}
          <Button type="submit" disabled={atualizar.isPending}>
            {atualizar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </Card>
    </Stage>
  )
}
