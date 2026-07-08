// Estado de "entrar como" / "ver painel de". Dois cenários:
//  - origem "negocio": o admin (Nível Negócio) entra como planejador/cliente;
//    o token do admin (fluxo_admin_token) é preservado e a limpeza (que zera
//    os tokens impersonados) acontece no mount do NegocioLayout.
//  - origem "planejador": o planejador abre o painel REAL de um cliente dele;
//    o token do planejador (fluxo_token) DEVE ser preservado — a limpeza
//    (só o token do cliente) acontece no mount do AppLayout ao voltar.
// Só um flag em sessionStorage (não localStorage: não sobrevive a aba nova).
const CHAVE = "fluxo_impersonando"
const CHAVE_ORIGEM = "fluxo_impersonando_origem"

export function iniciarImpersonacao(tipo, origem = "negocio") {
  sessionStorage.setItem(CHAVE, tipo) // "planejador" | "cliente"
  sessionStorage.setItem(CHAVE_ORIGEM, origem) // "negocio" | "planejador"
}

export function getImpersonacao() {
  return sessionStorage.getItem(CHAVE)
}

export function getImpersonacaoOrigem() {
  return sessionStorage.getItem(CHAVE_ORIGEM) || "negocio"
}

export function encerrarImpersonacao() {
  sessionStorage.removeItem(CHAVE)
  sessionStorage.removeItem(CHAVE_ORIGEM)
}
