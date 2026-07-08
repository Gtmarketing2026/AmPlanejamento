import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Stage from "../../components/layout/Stage"
import Card from "../../components/ui/Card"
import Field from "../../components/ui/Field"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import { atualizarPerfilAdmin, buscarPerfilAdmin, mfaSetup, mfaAtivar, mfaDesativar } from "../../api/negocio"

function MfaCard({ ativo, onMudou }) {
  const [setup, setSetup] = useState(null) // { secret, otpauth_uri, qr_svg_data_uri }
  const [codigo, setCodigo] = useState("")
  const [erro, setErro] = useState(null)
  const [modoDesativar, setModoDesativar] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function iniciarSetup() {
    setErro(null); setCarregando(true)
    try {
      setSetup(await mfaSetup())
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  async function confirmar() {
    setErro(null); setCarregando(true)
    try {
      await mfaAtivar(codigo)
      setSetup(null); setCodigo(""); onMudou()
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  async function desativar() {
    setErro(null); setCarregando(true)
    try {
      await mfaDesativar(codigo)
      setModoDesativar(false); setCodigo(""); onMudou()
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Card className="max-w-md mt-4">
      <div className="flex items-center justify-between mb-1">
        <div className="font-display font-semibold">Verificação em duas etapas (2FA)</div>
        {ativo ? <Pill variant="on">ativo</Pill> : <Pill variant="off">desativado</Pill>}
      </div>
      <p className="text-text-dim text-[12.5px] mb-3">
        Segundo fator no login do admin — protege o acesso mais poderoso do sistema mesmo que a senha vaze.
        Use um app como Google Authenticator ou Authy.
      </p>

      {/* Ativo: opção de desativar (exige código) */}
      {ativo && !modoDesativar && (
        <Button variant="ghost" onClick={() => { setModoDesativar(true); setErro(null) }}>Desativar 2FA</Button>
      )}
      {ativo && modoDesativar && (
        <div>
          <Field label="Código atual do app pra confirmar" value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="6 dígitos" inputMode="numeric" />
          <div className="flex gap-2">
            <Button onClick={desativar} disabled={carregando || codigo.length < 6}>Confirmar desativação</Button>
            <Button variant="ghost" onClick={() => { setModoDesativar(false); setCodigo(""); setErro(null) }}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Inativo: fluxo de setup */}
      {!ativo && !setup && (
        <Button onClick={iniciarSetup} disabled={carregando}>{carregando ? "Gerando…" : "Ativar 2FA"}</Button>
      )}
      {!ativo && setup && (
        <div>
          <p className="text-text-dim text-[12px] mb-2">
            1. Escaneie o QR no seu app autenticador (ou digite a chave manualmente):
          </p>
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <img src={setup.qr_svg_data_uri} alt="QR code 2FA" className="w-36 h-36 bg-white rounded-lg p-1.5" />
            <code className="text-[11px] text-accent font-mono break-all bg-panel-2 px-2 py-1 rounded">{setup.secret}</code>
          </div>
          <p className="text-text-dim text-[12px] mb-1.5">2. Digite o código de 6 dígitos que aparecer:</p>
          <Field label="" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="000000" inputMode="numeric" autoFocus />
          <div className="flex gap-2">
            <Button onClick={confirmar} disabled={carregando || codigo.length < 6}>Ativar</Button>
            <Button variant="ghost" onClick={() => { setSetup(null); setCodigo(""); setErro(null) }}>Cancelar</Button>
          </div>
        </div>
      )}
      {erro && <p className="text-red text-[12.5px] mt-3">{erro}</p>}
    </Card>
  )
}

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
          <p className="text-text-faint text-[11px] -mt-2 mb-3">Mín. 8 caracteres, com pelo menos uma letra e um número.</p>
          {atualizar.isError && <p className="text-red text-[12.5px] mb-3">{atualizar.error.message}</p>}
          {sucesso && <p className="text-accent text-[12.5px] mb-3">Dados atualizados.</p>}
          <Button type="submit" disabled={atualizar.isPending}>
            {atualizar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </form>
      </Card>

      <MfaCard ativo={!!perfil?.mfa_ativo} onMudou={() => qc.invalidateQueries({ queryKey: ["negocio-perfil"] })} />
    </Stage>
  )
}
