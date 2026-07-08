const BASE_URL = import.meta.env.VITE_API_BASE_URL

class ApiError extends Error {
  constructor(status, detail) {
    // detail pode ser string (mensagem) ou objeto estruturado (ex: 409 de
    // recadastro de cliente excluído, com `codigo`). Guardamos os dois:
    // `message` sempre uma string legível, `detail` o valor cru.
    const msg = typeof detail === "string" ? detail : detail?.mensagem || `Erro ${status}`
    super(msg)
    this.status = status
    this.detail = detail
  }
}

function getToken() {
  return localStorage.getItem("fluxo_token")
}

export function setToken(token) {
  if (token) localStorage.setItem("fluxo_token", token)
  else localStorage.removeItem("fluxo_token")
}

async function request(path, { method = "GET", body, auth = true, token } = {}) {
  const headers = { "Content-Type": "application/json" }
  if (auth) {
    const tokenFinal = token || getToken()
    if (tokenFinal) headers.Authorization = `Bearer ${tokenFinal}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !token) {
    // Só derruba a sessão do profissional quando o 401 veio de uma chamada
    // usando o token ambiente dele -- chamadas com token explícito (ex: do
    // cliente final) não devem mexer na sessão do profissional.
    setToken(null)
    // Deixa o AuthContext perceber a queda de sessão no próximo render/rota
    // protegida — evita import circular chamando navigate() daqui.
    window.dispatchEvent(new Event("fluxo:unauthorized"))
  }

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.detail)
  }

  return data
}

export const apiGet = (path, opts) => request(path, { ...opts, method: "GET" })
export const apiPost = (path, body, opts) => request(path, { ...opts, method: "POST", body })
export const apiPatch = (path, body, opts) => request(path, { ...opts, method: "PATCH", body })
export const apiDelete = (path, body, opts) => request(path, { ...opts, method: "DELETE", body })

export { ApiError }
