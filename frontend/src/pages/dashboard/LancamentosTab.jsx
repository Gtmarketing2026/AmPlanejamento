import Card from "../../components/ui/Card"
import { Select } from "../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import Pill from "../../components/ui/Pill"
import { dashboardMock as m } from "../../mocks/dashboard.mock"
import { useTransacoes } from "../../mocks/importacoesStore"

const LEGENDA = [
  { icone: "🏠", label: "Desp. obrigatórias" },
  { icone: "🛍️", label: "Desp. não obrig." },
  { icone: "🚗", label: "Financiamentos" },
  { icone: "⚖️", label: "Dívidas" },
  { icone: "💰", label: "Renda" },
  { icone: "📈", label: "Investimentos" },
  { icone: "🔄", label: "Classif. neutra" },
  { icone: "💼", label: "Empresa/autônomo" },
  { icone: "🎯", label: "Projetos" },
]

export default function LancamentosTab() {
  const { filtros } = m
  const transacoes = useTransacoes()

  return (
    <div>
      <Card className="mb-5">
        <div className="grid grid-cols-5 gap-3">
          <Select label="Tipo">
            {filtros.tipos.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select label="Instituição">
            {filtros.instituicoes.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select label="Categoria">
            {filtros.categorias.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select label="Subcategoria">
            {filtros.subcategorias.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select label="Cartão">
            {filtros.cartoes.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <Thead>
            <Th>Categoria</Th>
            <Th>Data</Th>
            <Th>Compra</Th>
            <Th>Cartão/Instituição</Th>
            <Th>Parcela</Th>
            <Th>Tags</Th>
            <Th className="text-right">Valor</Th>
          </Thead>
          <tbody>
            {transacoes.map((t) => (
              <Tr key={t.id} className="cursor-pointer hover:bg-panel">
                <Td>
                  <span className="mr-1.5">{t.icone}</span>
                  {t.categoria}
                </Td>
                <Td className="font-mono text-text-dim">{t.data}</Td>
                <Td>{t.compra}</Td>
                <Td className="text-text-dim">{t.origem}</Td>
                <Td className="font-mono text-text-dim">{t.parcela}</Td>
                <Td>
                  {t.tags.map((tag) => (
                    <Pill key={tag} variant="on">{tag}</Pill>
                  ))}
                </Td>
                <Td className={`text-right font-mono ${t.tipo === "entrada" ? "text-accent" : "text-red"}`}>
                  {t.valor}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <div className="text-text-faint text-[11.5px] mt-3">
          {transacoes.length} lançamentos no período (dado ilustrativo) · clique numa linha para editar
        </div>
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-line">
          {LEGENDA.map((l) => (
            <span key={l.label} className="text-[11px] text-text-faint flex items-center gap-1">
              <span>{l.icone}</span>
              {l.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
