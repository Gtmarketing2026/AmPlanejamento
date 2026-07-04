import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import Pill from "../../components/ui/Pill"
import DonutChart from "../../components/ui/DonutChart"
import BarRow from "../../components/ui/BarRow"
import SeletorCategoria from "../../components/ui/SeletorCategoria"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import {
  atualizarMinhaTransacao,
  meuPerfilCliente,
  minhasCategorias,
  minhasSubcategorias,
  minhasTransacoes,
} from "../../api/clientes"
import { ApiError } from "../../api/client"
import BannerImpersonacao from "../../components/negocio/BannerImpersonacao"
import { formatarData, formatarMoeda } from "../../lib/format"
import { getImpersonacao } from "../../lib/impersonacao"
import { dashboardMock as m } from "../../mocks/dashboard.mock"
import { getTokenCliente, setTokenCliente } from "./ClienteLoginPage"

export default function ClienteDashboardPage() {
  const navigate = useNavigate()
  const token = getTokenCliente()
  const qc = useQueryClient()

  const { data: perfil, error } = useQuery({
    queryKey: ["cliente-eu", token],
    queryFn: () => meuPerfilCliente(token),
    enabled: !!token,
    retry: false,
  })

  const { data: transacoes } = useQuery({
    queryKey: ["cliente-eu-transacoes", token],
    queryFn: () => minhasTransacoes(token),
    enabled: !!token,
  })
  const { data: categorias } = useQuery({
    queryKey: ["cliente-eu-categorias", token],
    queryFn: () => minhasCategorias(token),
    enabled: !!token,
  })
  const { data: subcategorias } = useQuery({
    queryKey: ["cliente-eu-subcategorias", token],
    queryFn: () => minhasSubcategorias(token),
    enabled: !!token,
  })
  const atualizarTransacao = useMutation({
    mutationFn: ({ id, dados }) => atualizarMinhaTransacao(token, id, dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] }),
  })

  useEffect(() => {
    if (!token || (error instanceof ApiError && error.status === 401)) {
      setTokenCliente(null)
      navigate("/cliente/login")
    }
  }, [token, error, navigate])

  function sair() {
    setTokenCliente(null)
    navigate("/cliente/login")
  }

  const impersonando = getImpersonacao() === "cliente"

  if (!token || !perfil) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-text-dim">Carregando…</div>
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      {impersonando && <BannerImpersonacao nome={perfil.nome} />}
      <div className="sticky top-0 z-40 bg-bg/92 backdrop-blur border-b border-line px-8 py-[18px] flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold">Olá, {perfil.nome.split(" ")[0]}</div>
          <div className="text-[11px] text-text-faint font-mono">
            visão só de leitura — fale com seu planejador pra fazer mudanças
          </div>
        </div>
        <button onClick={sair} className="px-3 py-2 rounded-[7px] text-[12.5px] text-text-faint hover:text-text-dim">
          Sair
        </button>
      </div>

      <div className="max-w-[900px] mx-auto px-8 py-10">
        <Card accent className="mb-5">
          <div className="flex items-center gap-4">
            <DonutChart pct={m.saudeFinanceira.pct} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold">Saúde financeira: {m.saudeFinanceira.status}</span>
                <Pill variant="on">reserva OK</Pill>
              </div>
              <p className="text-text-dim text-[12.5px] mt-1">
                Reserva de emergência cobre {m.saudeFinanceira.reservaMeses} meses de gastos · taxa de
                poupança de {m.saudeFinanceira.taxaPoupanca}% no mês
              </p>
            </div>
          </div>
        </Card>

        <Card className="mb-5">
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Gasto por categoria (dado ilustrativo)
          </div>
          {m.gastoPorCategoria.map((c) => (
            <BarRow key={c.label} label={c.label} pct={c.pct} value={c.valor} />
          ))}
        </Card>

        <Card>
          <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
            Lançamentos · você pode ajustar a categoria sugerida
          </div>
          <Table>
            <Thead>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Categoria</Th>
              <Th className="text-right">Valor</Th>
            </Thead>
            <tbody>
              {transacoes?.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-mono text-text-dim">{formatarData(t.data)}</Td>
                  <Td>{t.descricao}</Td>
                  <Td>
                    <SeletorCategoria
                      categoriaId={t.categoria_id}
                      subcategoriaId={t.subcategoria_id}
                      categorias={categorias}
                      subcategorias={subcategorias}
                      disabled={atualizarTransacao.isPending}
                      onChange={(dados) => atualizarTransacao.mutate({ id: t.id, dados })}
                    />
                  </Td>
                  <Td className={`text-right font-mono ${t.tipo === "entrada" ? "text-accent" : "text-red"}`}>
                    {t.tipo === "entrada" ? "+ " : "- "}
                    {formatarMoeda(t.valor)}
                  </Td>
                </Tr>
              ))}
              {!transacoes?.length && (
                <Tr>
                  <Td colSpan={4} className="text-text-faint text-center py-6">
                    Nenhum lançamento ainda.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
