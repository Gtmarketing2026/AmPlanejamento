import { apiDelete, apiGet, apiPatch, apiPost } from "./client"

export const listarClientes = () => apiGet("/clientes")

// Classificação de saúde (termômetro) de todos os clientes do planejador.
export const resumoSaudeClientes = () => apiGet("/clientes/saude-resumo")

export const criarCliente = (dados) => apiPost("/clientes", dados)

export const atualizarCliente = (id, dados) => apiPatch(`/clientes/${id}`, dados)

export const excluirCliente = (id, dados) => apiDelete(`/clientes/${id}`, dados)

// Planejador abre o painel REAL do próprio cliente (emite token de cliente).
export const abrirPainelCliente = (id) => apiPost(`/clientes/${id}/abrir-painel`, {})

export const loginCliente = (nickname, senha) =>
  apiPost("/clientes/login", { nickname, senha }, { auth: false })

export const meuPerfilCliente = (token) => apiGet("/clientes/eu", { token })
export const aceitarTermosCliente = (token) => apiPost("/clientes/eu/aceitar-termos", {}, { token })

// Cadastro simples do cônjuge pelo próprio cliente (Configurações).
export const atualizarMeuConjuge = (token, conjuge_nome) =>
  apiPatch("/clientes/eu/conjuge", { conjuge_nome }, { token })

export const minhasCategorias = (token) => apiGet("/clientes/eu/categorias", { token })
export const criarMinhaCategoria = (token, dados) => apiPost("/clientes/eu/categorias", dados, { token })
export const atualizarMinhaCategoria = (token, id, dados) =>
  apiPatch(`/clientes/eu/categorias/${id}`, dados, { token })
export const excluirMinhaCategoria = (token, id) =>
  apiDelete(`/clientes/eu/categorias/${id}`, undefined, { token })

export const minhasSubcategorias = (token) => apiGet("/clientes/eu/subcategorias", { token })
export const criarMinhaSubcategoria = (token, dados) => apiPost("/clientes/eu/subcategorias", dados, { token })
export const atualizarMinhaSubcategoria = (token, id, dados) =>
  apiPatch(`/clientes/eu/subcategorias/${id}`, dados, { token })
export const excluirMinhaSubcategoria = (token, id) =>
  apiDelete(`/clientes/eu/subcategorias/${id}`, undefined, { token })

// Tags: vocabulário livre do planejador, reaproveitado em todos os clientes
// dele -- cliente final também cria (mesmo vocabulário do profissional).
export const minhasTags = (token) => apiGet("/clientes/eu/tags", { token })
export const criarMinhaTag = (token, nome) => apiPost("/clientes/eu/tags", { nome }, { token })
export const excluirMinhaTag = (token, id) => apiDelete(`/clientes/eu/tags/${id}`, undefined, { token })

export const minhasTransacoes = (token, filtros = {}) => {
  const params = new URLSearchParams()
  Object.entries(filtros).forEach(([k, v]) => {
    if (v) params.set(k, v)
  })
  const qs = params.toString()
  return apiGet(`/clientes/eu/transacoes${qs ? `?${qs}` : ""}`, { token })
}

export const criarMinhaTransacao = (token, dados) => apiPost("/clientes/eu/transacoes", dados, { token })

export const atualizarMinhaTransacao = (token, id, dados) =>
  apiPatch(`/clientes/eu/transacoes/${id}`, dados, { token })

export const excluirMinhaTransacao = (token, id) =>
  apiDelete(`/clientes/eu/transacoes/${id}`, undefined, { token })

// Reclassificar por IA os lançamentos informados (do período/filtro atual).
export const reclassificarMinhasTransacoes = (token, ids) =>
  apiPost("/clientes/eu/transacoes/reclassificar", { ids }, { token })

export const enviarTransacaoEmpresa = (token, id, acao) =>
  apiPost(`/clientes/eu/transacoes/${id}/empresa`, { acao }, { token })

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function importarMeuExtrato(token, { tipoDocumento, senhaPdf, contaId, contexto, mesReferencia, arquivo, forcar }) {
  const form = new FormData()
  form.append("tipo_documento", tipoDocumento)
  if (senhaPdf) form.append("senha_pdf", senhaPdf)
  if (contaId) form.append("conta_conectada_id", contaId)
  if (contexto) form.append("contexto", contexto)
  // mesReferencia = "AAAA-MM" (do <input type=month>); manda o 1º dia do mês.
  if (mesReferencia) form.append("mes_referencia", `${mesReferencia}-01`)
  if (forcar) form.append("forcar", "true")
  form.append("arquivo", arquivo)
  const res = await fetch(`${BASE_URL}/clientes/eu/importacoes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json()
  if (!res.ok) {
    // Arquivo já importado antes: erro estruturado pra UI pedir confirmação.
    if (res.status === 409 && data?.detail?.codigo === "arquivo_ja_importado") {
      const e = new Error(data.detail.mensagem)
      e.arquivoJaImportado = true
      throw e
    }
    const detalhe = typeof data?.detail === "string" ? data.detail : `Erro ${res.status}`
    throw new Error(detalhe)
  }
  return data
}

export const listarMinhasImportacoes = (token) => apiGet("/clientes/eu/importacoes", { token })

export const gerarMinhasParcelas = (token, importacaoId) =>
  apiPost(`/clientes/eu/importacoes/${importacaoId}/gerar-parcelas`, {}, { token })

// 2ª etapa da importação: classificação por IA (separada do upload).
export const classificarMinhaImportacao = (token, importacaoId) =>
  apiPost(`/clientes/eu/importacoes/${importacaoId}/classificar`, {}, { token })

export const excluirMinhaImportacao = (token, id) =>
  apiDelete(`/clientes/eu/importacoes/${id}`, undefined, { token })

// Ajusta o mês de referência de todos os lançamentos de uma importação.
// mesRefIso = "AAAA-MM-01".
export const atualizarMesRefImportacao = (token, id, mesRefIso) =>
  apiPatch(`/clientes/eu/importacoes/${id}/mes-referencia`, { mes_referencia: mesRefIso }, { token })

// Reatribui todos os lançamentos de uma importação a uma conta/cartão (ou
// desvincula com null). contaId = uuid da conta ou null.
export const atualizarContaImportacao = (token, id, contaId) =>
  apiPatch(`/clientes/eu/importacoes/${id}/conta`, { conta_conectada_id: contaId }, { token })
