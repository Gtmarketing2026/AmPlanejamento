import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Card from "../../../components/ui/Card"
import Button from "../../../components/ui/Button"
import { Select } from "../../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../../components/ui/Table"
import { minhasTransacoes } from "../../../api/clientes"
import { formatarMoeda } from "../../../lib/format"
import { exportarCsv, exportarPdfViaImpressao } from "../../../lib/exportar"

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

export default function ClarezaFinanceiraTab({ token }) {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ["cliente-eu-transacoes-todas", token],
    queryFn: () => minhasTransacoes(token),
    enabled: !!token,
  })

  const porMes = useMemo(() => {
    const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, receitas: 0, despesas: 0 }))
    transacoes.forEach((t) => {
      const [tAno, tMes] = t.data.split("-").map(Number)
      if (tAno !== ano) return
      const alvo = meses[tMes - 1]
      if (t.tipo === "entrada") alvo.receitas += Math.abs(Number(t.valor))
      else alvo.despesas += Math.abs(Number(t.valor))
    })
    return meses.map((m) => ({ ...m, resultado: m.receitas - m.despesas }))
  }, [transacoes, ano])

  const totalReceitas = porMes.reduce((s, m) => s + m.receitas, 0)
  const totalDespesas = porMes.reduce((s, m) => s + m.despesas, 0)
  const totalResultado = totalReceitas - totalDespesas

  function exportarPlanilha() {
    exportarCsv(
      `clareza-financeira-${ano}.csv`,
      porMes.map((m) => ({
        mes: MESES_ABREV[m.mes - 1],
        receitas: m.receitas.toFixed(2),
        despesas: m.despesas.toFixed(2),
        resultado: m.resultado.toFixed(2),
      }))
    )
  }

  function exportarPdf() {
    const linhas = porMes
      .map(
        (m) =>
          `<tr><td>${MESES_ABREV[m.mes - 1]}/${ano}</td><td class="right">${formatarMoeda(
            m.receitas
          )}</td><td class="right">${formatarMoeda(m.despesas)}</td><td class="right">${formatarMoeda(
            m.resultado
          )}</td></tr>`
      )
      .join("")
    exportarPdfViaImpressao(
      `Clareza Financeira ${ano}`,
      `<table><thead><tr><th>Mês</th><th class="right">Receitas</th><th class="right">Despesas</th><th class="right">Resultado</th></tr></thead>
       <tbody>${linhas}<tr><td><strong>Total</strong></td><td class="right"><strong>${formatarMoeda(
         totalReceitas
       )}</strong></td><td class="right"><strong>${formatarMoeda(
        totalDespesas
      )}</strong></td><td class="right"><strong>${formatarMoeda(totalResultado)}</strong></td></tr></tbody></table>`
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Select label="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-28">
          {[hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={exportarPdf}>
            Exportar PDF
          </Button>
          <Button variant="ghost" onClick={exportarPlanilha}>
            Exportar Excel/CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">Receitas</div>
          <div className="font-display text-lg font-semibold text-accent">{formatarMoeda(totalReceitas)}</div>
        </Card>
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">Despesas</div>
          <div className="font-display text-lg font-semibold text-red">{formatarMoeda(totalDespesas)}</div>
        </Card>
        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-1">Resultado</div>
          <div className={`font-display text-lg font-semibold ${totalResultado >= 0 ? "text-accent" : "text-red"}`}>
            {formatarMoeda(totalResultado)}
          </div>
        </Card>
      </div>

      <Card>
        {isLoading && <p className="text-text-faint text-sm">Carregando…</p>}
        {!isLoading && (
          <Table>
            <Thead>
              <Th>Mês</Th>
              <Th className="text-right">Receitas</Th>
              <Th className="text-right">Despesas</Th>
              <Th className="text-right">Resultado</Th>
            </Thead>
            <tbody>
              {porMes.map((m) => (
                <Tr key={m.mes}>
                  <Td className="font-mono text-text-dim">
                    {MESES_ABREV[m.mes - 1]}/{ano}
                  </Td>
                  <Td className="text-right font-mono text-accent">{formatarMoeda(m.receitas)}</Td>
                  <Td className="text-right font-mono text-red">{formatarMoeda(m.despesas)}</Td>
                  <Td className={`text-right font-mono ${m.resultado >= 0 ? "text-text" : "text-red"}`}>
                    {formatarMoeda(m.resultado)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
