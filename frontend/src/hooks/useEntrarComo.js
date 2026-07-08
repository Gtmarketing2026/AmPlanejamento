import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { entrarComoCliente, entrarComoPlanejador } from "../api/negocio"
import { useAuth } from "../context/AuthContext"
import { setTokenCliente } from "../pages/clienteFinal/ClienteLoginPage"
import { iniciarImpersonacao } from "../lib/impersonacao"

// Admin "entra como" um planejador ou cliente: recebe um token real
// (emitido por POST /negocio/.../entrar) e navega pra SPA de verdade dessa
// conta -- 100% do painel dela, não uma tela resumida do nível Negócio.
export function useEntrarComo() {
  const navigate = useNavigate()
  const { entrarComToken } = useAuth()
  const [carregando, setCarregando] = useState(false)

  async function entrarPlanejador(id) {
    setCarregando(true)
    try {
      const { access_token } = await entrarComoPlanejador(id)
      // entrarComToken (não só setToken) é essencial aqui: atualiza o
      // AuthContext pra buscar o perfil desse profissional AGORA, senão o
      // ProtectedRoute continua achando que ninguém está logado (ele só lê
      // o perfil uma vez, no carregamento inicial da página) e manda de
      // volta pro /login.
      await entrarComToken(access_token)
      iniciarImpersonacao("planejador")
      navigate("/inicio")
    } finally {
      setCarregando(false)
    }
  }

  async function entrarCliente(id) {
    setCarregando(true)
    try {
      const { access_token } = await entrarComoCliente(id)
      setTokenCliente(access_token)
      iniciarImpersonacao("cliente")
      navigate("/cliente/dashboard")
    } finally {
      setCarregando(false)
    }
  }

  return { entrarPlanejador, entrarCliente, carregando }
}
