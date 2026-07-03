export function formatarData(isoDate) {
  if (!isoDate) return "—"
  const [ano, mes, dia] = isoDate.split("T")[0].split("-")
  return `${dia}/${mes}/${ano}`
}

export function somarDias(isoDate, dias) {
  const d = new Date(isoDate.split("T")[0] + "T00:00:00")
  d.setDate(d.getDate() + dias)
  return d.toISOString().split("T")[0]
}

export function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return "—"
  return `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

export function formatarCiclo(isoDate) {
  if (!isoDate) return "—"
  const [ano, mes] = isoDate.split("T")[0].split("-")
  return `${MESES[Number(mes) - 1]}/${ano}`
}

const STATUS_FATURA = {
  paga: { label: "paga", variant: "on" },
  pendente: { label: "pendente", variant: "warn" },
  atrasada: { label: "atrasada", variant: "off" },
  cancelada: { label: "cancelada", variant: "off" },
}

export function statusFatura(status) {
  return STATUS_FATURA[status] || { label: status, variant: "neutral" }
}

export function iniciais(nome) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}
