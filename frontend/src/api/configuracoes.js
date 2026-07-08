import { apiGet, apiPatch } from "./client"

// Critérios da saúde financeira (limiares que classificam o cliente em
// Vermelho/Amarelo/Verde/Azul). Token ambiente do planejador.
export const obterCriteriosSaude = () => apiGet("/configuracoes/saude")
export const atualizarCriteriosSaude = (dados) => apiPatch("/configuracoes/saude", dados)
