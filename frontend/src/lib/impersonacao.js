// Estado de "entrar como" — o admin (nível Negócio) recebe um token real de
// profissional/cliente e passa a usar a SPA de verdade. Guardamos só um flag
// em sessionStorage (não localStorage: não deve sobreviver a uma aba nova)
// pra saber quando mostrar o banner "Voltar ao Painel do Negócio" -- o token
// do admin (fluxo_admin_token) nunca é apagado nesse processo, então voltar
// é só limpar esse flag e o token impersonado.
const CHAVE = "fluxo_impersonando"

export function iniciarImpersonacao(tipo) {
  sessionStorage.setItem(CHAVE, tipo) // "planejador" | "cliente"
}

export function getImpersonacao() {
  return sessionStorage.getItem(CHAVE)
}

export function encerrarImpersonacao() {
  sessionStorage.removeItem(CHAVE)
}
