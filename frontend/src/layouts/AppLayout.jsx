import { useEffect } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"
import Topbar from "../components/layout/Topbar"
import BannerImpersonacao from "../components/negocio/BannerImpersonacao"
import { useAuth } from "../context/AuthContext"
import { getImpersonacao, getImpersonacaoOrigem, encerrarImpersonacao } from "../lib/impersonacao"
import { setTokenCliente } from "../pages/clienteFinal/ClienteLoginPage"

export default function AppLayout() {
  const { profissional } = useAuth()
  const location = useLocation()
  const impersonando = getImpersonacao() === "planejador"

  // Ao voltar do painel de um cliente (o planejador abriu o painel real dele),
  // limpamos SÓ o token do cliente e o flag — NUNCA o token do planejador
  // (fluxo_token), que precisa continuar válido. Feito no mount daqui, só
  // depois de já termos aterrissado em /clientes (mesmo padrão do NegocioLayout).
  useEffect(() => {
    if (getImpersonacao() === "cliente" && getImpersonacaoOrigem() === "planejador") {
      encerrarImpersonacao()
      setTokenCliente(null)
    }
  }, [])
  // Paywall DURO: sem plano ativo (o trial acabou e não assinou), o app inteiro
  // fica bloqueado -- qualquer rota que ele clicar cai na /assinatura, que é a
  // ÚNICA que abre. Enquanto está no trial, plano_ativo=true e navega normal.
  // Não bloqueia quando é o admin "entrando como" o planejador (oversight).
  const semPlano = profissional && profissional.plano_ativo === false
  const bloqueado = semPlano && !impersonando && location.pathname !== "/assinatura"

  // O app do planejador acompanha a cor de marca escolhida por ele (accent).
  // Sobrescreve as CSS vars --color-accent; se não tiver cor, mantém o padrão.
  const estiloMarca = profissional?.cor_marca
    ? { "--color-accent": profissional.cor_marca, "--color-accent-dim": profissional.cor_marca }
    : undefined

  return (
    <div className="min-h-screen bg-bg text-text" style={estiloMarca}>
      {impersonando && <BannerImpersonacao nome={profissional?.nome || "planejador"} />}
      <Topbar />
      {semPlano && !bloqueado && (
        <div className="bg-amber/10 border-b border-amber/30 px-8 py-2.5 text-amber text-[12.5px]">
          ⚠️ Seu período de teste terminou. Escolha e pague um plano abaixo para reativar o AMplanejador.
        </div>
      )}
      {bloqueado ? <Navigate to="/assinatura" replace /> : <Outlet />}
    </div>
  )
}
