import { apiGet, apiPost } from "./client"

// Open Finance via Pluggy (cliente final).
export const pluggyStatus = (token) => apiGet("/clientes/eu/pluggy/status", { token })
export const pluggyConnectToken = (token) => apiPost("/clientes/eu/pluggy/connect-token", {}, { token })
export const pluggySync = (token, itemId) => apiPost("/clientes/eu/pluggy/sync", { item_id: itemId }, { token })
