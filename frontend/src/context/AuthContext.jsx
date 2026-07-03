import { createContext, useContext, useEffect, useState, useCallback } from "react"
import * as authApi from "../api/auth"
import { setToken } from "../api/client"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profissional, setProfissional] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregarPerfil = useCallback(async () => {
    const token = localStorage.getItem("fluxo_token")
    if (!token) {
      setProfissional(null)
      setLoading(false)
      return
    }
    try {
      const perfil = await authApi.meuPerfil()
      setProfissional(perfil)
    } catch {
      setToken(null)
      setProfissional(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarPerfil()
    const onUnauthorized = () => {
      setProfissional(null)
    }
    window.addEventListener("fluxo:unauthorized", onUnauthorized)
    return () => window.removeEventListener("fluxo:unauthorized", onUnauthorized)
  }, [carregarPerfil])

  async function entrar(email, senha) {
    const { access_token } = await authApi.login(email, senha)
    setToken(access_token)
    await carregarPerfil()
  }

  async function cadastrar(nome, email, senha, subdominio) {
    const { access_token } = await authApi.cadastrar(nome, email, senha, subdominio)
    setToken(access_token)
    await carregarPerfil()
  }

  function sair() {
    setToken(null)
    setProfissional(null)
  }

  return (
    <AuthContext.Provider
      value={{ profissional, loading, autenticado: !!profissional, entrar, cadastrar, sair }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider")
  return ctx
}
