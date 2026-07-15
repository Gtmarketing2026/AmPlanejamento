import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Button from "../ui/Button"
import { pluggyConnectToken, pluggyStatus, pluggySync } from "../../api/pluggy"

// SDK oficial do Pluggy Connect (carregado sob demanda de cdn.pluggy.ai --
// liberado no CSP em frontend/vercel.json). O widget abre um iframe de
// connect.pluggy.ai; ao final devolve o itemId, que mandamos pro backend
// sincronizar as transações.
const SDK_URL = "https://cdn.pluggy.ai/pluggy-connect/v2.8.2/pluggy-connect.js"
let sdkPromise = null
function carregarSdk() {
  if (window.PluggyConnect) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SDK_URL
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      sdkPromise = null
      reject(new Error("Falha ao carregar o Pluggy Connect"))
    }
    document.body.appendChild(s)
  })
  return sdkPromise
}

export default function ConectarBanco({ token }) {
  const qc = useQueryClient()
  const [msg, setMsg] = useState(null)
  const [carregando, setCarregando] = useState(false)

  // Só mostra o botão se o Open Finance estiver configurado (chaves na Vercel).
  const { data: status } = useQuery({
    queryKey: ["cliente-eu-pluggy-status", token],
    queryFn: () => pluggyStatus(token),
    enabled: !!token,
  })

  const sync = useMutation({
    mutationFn: (itemId) => pluggySync(token, itemId),
    onSuccess: (res) => {
      setMsg({
        tipo: "ok",
        texto: `${res.banco}: ${res.importadas} lançamento(s) importado(s)${
          res.duplicadas ? ` · ${res.duplicadas} já existiam` : ""
        }.`,
      })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes"] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes-todas"] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-contas"] })
    },
    onError: () =>
      setMsg({ tipo: "erro", texto: "Banco conectado, mas não consegui puxar as transações agora. Tente de novo." }),
  })

  async function conectar() {
    setMsg(null)
    setCarregando(true)
    try {
      const { access_token } = await pluggyConnectToken(token)
      await carregarSdk()
      const pluggy = new window.PluggyConnect({
        connectToken: access_token,
        includeSandbox: true, // mostra os bancos-teste do sandbox
        onSuccess: (data) => {
          const itemId = data?.item?.id
          if (itemId) sync.mutate(itemId)
          else setMsg({ tipo: "erro", texto: "Conexão sem retorno do banco. Tente de novo." })
        },
        onError: () => setMsg({ tipo: "erro", texto: "Não foi possível conectar o banco." }),
      })
      pluggy.init()
    } catch {
      setMsg({ tipo: "erro", texto: "Open Finance indisponível no momento." })
    } finally {
      setCarregando(false)
    }
  }

  if (!status?.ativo) return null

  return (
    <div>
      <Button onClick={conectar} disabled={carregando || sync.isPending}>
        {carregando ? "Abrindo…" : sync.isPending ? "Importando…" : "🔗 Conectar banco (Open Finance)"}
      </Button>
      <p className="text-text-faint text-[11.5px] mt-1.5">
        Conecte sua conta via Open Finance e os lançamentos entram sozinhos — sem precisar enviar arquivo.
      </p>
      {msg && (
        <p className={`text-[12.5px] mt-2 ${msg.tipo === "ok" ? "text-accent" : "text-red"}`}>{msg.texto}</p>
      )}
    </div>
  )
}
