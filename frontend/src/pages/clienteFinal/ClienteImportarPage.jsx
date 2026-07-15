import { useRef, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import Button from "../../components/ui/Button"
import Pill from "../../components/ui/Pill"
import Field, { Select } from "../../components/ui/Field"
import { Table, Thead, Th, Tr, Td } from "../../components/ui/Table"
import ConectarBanco from "../../components/cliente/ConectarBanco"
import {
  atualizarContaImportacao,
  atualizarMesRefImportacao,
  classificarMinhaImportacao,
  excluirMinhaImportacao,
  gerarMinhasParcelas,
  importarMeuExtrato,
  listarMinhasImportacoes,
} from "../../api/clientes"
import { listarMinhasContas } from "../../api/contas"
import { formatarData } from "../../lib/format"

const STATUS_VARIANT = { processado: "on", processando: "warn", pendente: "warn", erro: "off" }

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
// Mês(es) de referência a partir do min/max (datas "AAAA-MM-DD"). Um só = "jul/2026";
// vários = "jun–jul/2026"; nenhum (import sem lançamentos) = "—".
function mesRefLabel(ini, fim) {
  if (!ini) return "—"
  const f = (d) => {
    const [y, m] = d.split("-")
    return `${MESES[Number(m) - 1]}/${y}`
  }
  return !fim || ini === fim ? f(ini) : `${f(ini)}–${f(fim)}`
}

export default function ClienteImportarPage() {
  const { token, perfil } = useOutletContext()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const inputRef = useRef(null)
  const [tipoDocumento, setTipoDocumento] = useState("extrato")
  const [arquivo, setArquivo] = useState(null)
  const [senhaPdf, setSenhaPdf] = useState("")
  const [contaId, setContaId] = useState("")
  const [contexto, setContexto] = useState("PF")
  const [mesRefManual, setMesRefManual] = useState("") // "AAAA-MM"; vazio = automático pela data
  const [avisoOcr, setAvisoOcr] = useState(null) // importação lida por OCR -> abre aviso de conferência
  const [erro, setErro] = useState(null)
  const ehPdf = arquivo?.name?.toLowerCase().endsWith(".pdf")
  // Só faz sentido escolher PF/PJ quando o cliente também tem empresa (CNPJ).
  const temPJ = !!perfil?.cnpj

  const { data: importacoes = [] } = useQuery({
    queryKey: ["cliente-eu-importacoes", token],
    queryFn: () => listarMinhasImportacoes(token),
    enabled: !!token,
  })
  const { data: contas = [] } = useQuery({
    queryKey: ["cliente-eu-contas", token],
    queryFn: () => listarMinhasContas(token),
    enabled: !!token,
  })
  const naturezaEsperada = tipoDocumento === "fatura_cartao" ? "cartao" : "conta"
  const contasCompativeis = contas.filter((c) => c.natureza === naturezaEsperada)

  const importar = useMutation({
    mutationFn: (forcar = false) =>
      importarMeuExtrato(token, {
        tipoDocumento,
        senhaPdf: senhaPdf || null,
        contaId: contaId || null,
        contexto: temPJ ? contexto : "PF",
        mesReferencia: mesRefManual || null,
        arquivo,
        forcar,
      }),
    onSuccess: async (imp) => {
      // Compras parceladas: pergunta se quer projetar as parcelas futuras.
      if (imp?.parcelamentos_detectados > 0) {
        const ok = confirm(
          `Encontramos ${imp.parcelamentos_detectados} compra(s) parcelada(s). ` +
            `Deseja gerar as parcelas futuras nos próximos meses pra ter a visão completa dos gastos? ` +
            `(Elas aparecem como "previstas" e são substituídas automaticamente quando a fatura real chega.)`
        )
        if (ok) await gerarMinhasParcelas(token, imp.id)
      }
      // Fatura lida por OCR (leitura de imagem): pode escapar algum lançamento,
      // então abre um aviso pra pessoa CONFERIR contra a fatura original.
      if (imp?.lido_por_ocr) setAvisoOcr(imp)
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-contas", token] })
      setArquivo(null)
      setSenhaPdf("")
      if (inputRef.current) inputRef.current.value = ""
      // 2ª etapa: classificação por IA num request separado (não trava o upload,
      // sem risco de timeout). Os lançamentos já apareceram; as categorias
      // preenchem quando isto volta. Best-effort — falha aqui não é erro do upload.
      // Só dispara (e só mostra o aviso "IA classificando") quando REALMENTE há
      // lançamentos sem categoria pra IA processar -- senão o aviso apareceria à
      // toa (reimport duplicado, ou tudo já resolvido pelas regras) e enganaria.
      if (imp?.id && imp?.transacoes_sem_categoria > 0) classificar.mutate(imp.id)
    },
    onError: (e) => {
      // Arquivo já importado antes: pergunta se quer importar mesmo assim.
      if (e?.arquivoJaImportado) {
        if (confirm(`${e.message}`)) importar.mutate(true)
        return
      }
      setErro(e.message)
    },
  })

  const classificar = useMutation({
    // mutationKey estável: o ClienteLayout usa useIsMutating(["classificar-ia"])
    // pra mostrar o aviso "IA classificando" em QUALQUER aba enquanto isto roda
    // -- inclusive depois que a pessoa sai desta página (a mutation continua no
    // cache do React Query mesmo com o componente desmontado).
    mutationKey: ["classificar-ia"],
    mutationFn: (id) => classificarMinhaImportacao(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes", token] })
    },
    onError: () => {}, // best-effort: dá pra classificar manualmente depois
  })

  const excluir = useMutation({
    mutationFn: (id) => excluirMinhaImportacao(token, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
    },
  })

  // Edição do mês de referência da importação (aplica a todos os lançamentos dela).
  const [editMesId, setEditMesId] = useState(null)
  const [mesInput, setMesInput] = useState("")
  const salvarMes = useMutation({
    mutationFn: ({ id, mes }) => atualizarMesRefImportacao(token, id, `${mes}-01`),
    onSuccess: () => {
      setEditMesId(null)
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
    },
  })
  function abrirEditMes(imp) {
    setEditMesId(imp.id)
    setMesInput((imp.mes_ref_inicio || "").slice(0, 7)) // "AAAA-MM"
  }

  // Reatribuir a conta/cartão de toda a importação (re-vincular em massa).
  const [editContaId, setEditContaId] = useState(null)
  const salvarConta = useMutation({
    mutationFn: ({ id, contaId }) => atualizarContaImportacao(token, id, contaId || null),
    onSuccess: () => {
      setEditContaId(null)
      qc.invalidateQueries({ queryKey: ["cliente-eu-importacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-transacoes", token] })
      qc.invalidateQueries({ queryKey: ["cliente-eu-contas", token] })
    },
  })

  // Abre a aba Lançamentos já filtrada só pelos lançamentos desta importação.
  function verLancamentos(imp) {
    navigate("/cliente/dashboard", {
      state: { tab: "lancamentos", filtros: { importacao_id: imp.id } },
    })
  }

  function onEnviar(e) {
    e.preventDefault()
    setErro(null)
    if (!arquivo) return
    importar.mutate()
  }

  return (
    <div className="max-w-[820px] mx-auto px-8 py-10">
      {avisoOcr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-panel border border-amber/50 rounded-[14px] shadow-xl max-w-[440px] w-full p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[22px]">⚠️</span>
              <h2 className="font-display text-[16px] font-semibold">Confira esta fatura</h2>
            </div>
            <p className="text-text-dim text-[13px] leading-relaxed mb-3">
              Este PDF estava difícil de ler, então usamos <strong className="text-text">leitura por imagem (OCR)</strong>.
              A leitura costuma vir completa, mas <strong className="text-text">pode escapar algum lançamento</strong>.
            </p>
            <p className="text-text-dim text-[13px] leading-relaxed mb-4">
              Compare os lançamentos importados com a <strong className="text-text">fatura original</strong>. Se faltar
              ou vier errado algum, <strong className="text-text">exclua esta importação e importe de novo</strong>, ou
              ajuste manualmente na aba Lançamentos.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  const imp = avisoOcr
                  setAvisoOcr(null)
                  navigate("/cliente/dashboard", {
                    state: { tab: "lancamentos", filtros: { importacao_id: imp.id } },
                  })
                }}
              >
                Ver os lançamentos
              </Button>
              <Button onClick={() => setAvisoOcr(null)}>Entendi, vou conferir</Button>
            </div>
          </div>
        </div>
      )}

      <h1 className="font-display text-xl font-semibold mb-1">Importar extrato / fatura</h1>
      <p className="text-text-dim text-sm mb-5">
        Conecte seu banco pelo Open Finance (automático) ou envie um arquivo (OFX, CSV ou PDF). Os
        lançamentos entram no seu painel já com a categoria sugerida — você pode ajustar depois.
      </p>

      {/* Conexão automática via Open Finance (só aparece se o Pluggy estiver ligado). */}
      <ConectarBanco token={token} />

      <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono my-5">
        ou envie um arquivo
      </div>

      <Card className="mb-5">
        <form onSubmit={onEnviar} className="flex items-end gap-3 flex-wrap">
          <Select
            label="Tipo"
            value={tipoDocumento}
            onChange={(e) => {
              setTipoDocumento(e.target.value)
              setContaId("")
            }}
          >
            <option value="extrato">Extrato de conta</option>
            <option value="fatura_cartao">Fatura de cartão</option>
          </Select>
          {temPJ && (
            <Select label="Entra em" value={contexto} onChange={(e) => setContexto(e.target.value)}>
              <option value="PF">Pessoal (PF)</option>
              <option value="PJ">Empresa (PJ)</option>
            </Select>
          )}
          <div className="mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">
              Mês de referência (opcional)
            </div>
            <input
              type="month"
              value={mesRefManual}
              onChange={(e) => setMesRefManual(e.target.value)}
              className="bg-bg border border-line rounded-[9px] px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent/60"
              title="Se preenchido, todos os lançamentos desta importação contam neste mês. Deixe vazio para calcular pela data de cada lançamento."
            />
          </div>
          {naturezaEsperada === "cartao" ? (
            // Fatura de cartão: o cartão é OBRIGATÓRIO (é o que abate do limite).
            <div>
              <Select label="Cartão (obrigatório)" value={contaId} onChange={(e) => setContaId(e.target.value)}>
                <option value="">Selecione o cartão…</option>
                {contasCompativeis.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_exibicao}</option>
                ))}
              </Select>
              {!contasCompativeis.length && (
                <p className="text-amber text-[11px] mt-1 max-w-[180px]">
                  Nenhum cartão cadastrado. Cadastre na aba Contas antes de importar a fatura.
                </p>
              )}
            </div>
          ) : (
            !!contasCompativeis.length && (
              <Select label="Conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
                <option value="">Sem conta específica</option>
                {contasCompativeis.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_exibicao}</option>
                ))}
              </Select>
            )
          )}
          <div className="mb-3">
            <div className="text-[11px] text-text-faint uppercase tracking-wide mb-1.5 font-mono">Arquivo</div>
            <input
              ref={inputRef}
              type="file"
              accept=".ofx,.csv,.pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              className="text-[12.5px] text-text-dim file:mr-3 file:py-2 file:px-3 file:rounded-[7px] file:border file:border-line file:bg-panel-2 file:text-text-dim"
            />
          </div>
          {ehPdf && (
            <div className="mb-3 w-48">
              <Field
                label="Senha do PDF (se houver)"
                type="password"
                value={senhaPdf}
                onChange={(e) => setSenhaPdf(e.target.value)}
                placeholder="opcional"
              />
            </div>
          )}
          <Button
            type="submit"
            className="mb-3"
            disabled={!arquivo || importar.isPending || (naturezaEsperada === "cartao" && !contaId)}
          >
            {importar.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </form>
        {ehPdf && (
          <p className="text-text-faint text-[11.5px] -mt-2 mb-1">
            Faturas de cartão às vezes vêm protegidas por senha (geralmente dígitos do CPF ou nascimento do titular).
          </p>
        )}
        {classificar.isPending && (
          <p className="text-accent text-[12px] mt-1">
            ✨ Lançamentos importados! A IA está classificando as categorias — o aviso no topo
            some sozinho quando terminar (pode navegar à vontade nesse meio-tempo).
          </p>
        )}
        {erro && <p className="text-red text-[12.5px] mt-1">{erro}</p>}
      </Card>

      <Card>
        <div className="text-[11px] text-text-faint uppercase tracking-wide font-mono mb-3">
          Importações
        </div>
        <Table>
          <Thead>
            <Th>Enviado em</Th>
            <Th>Tipo</Th>
            <Th>Conta</Th>
            <Th>Mês ref.</Th>
            <Th>Formato</Th>
            <Th>Lançamentos</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <tbody>
            {importacoes.map((imp) => (
              <Tr
                key={imp.id}
                onClick={() => verLancamentos(imp)}
                className="cursor-pointer hover:bg-panel-2"
                title="Ver os lançamentos desta importação"
              >
                <Td className="font-mono text-text-dim">{formatarData(imp.criado_em)}</Td>
                <Td>{imp.tipo_documento === "fatura_cartao" ? "Fatura" : "Extrato"}</Td>
                <Td className="text-text-dim">
                  {editContaId === imp.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <select
                        autoFocus
                        defaultValue={imp.conta_nome ? "" : ""}
                        onChange={(e) => salvarConta.mutate({ id: imp.id, contaId: e.target.value })}
                        onBlur={() => setEditContaId(null)}
                        disabled={salvarConta.isPending}
                        className="bg-bg border border-line rounded px-1.5 py-1 text-[11.5px] text-text max-w-[160px] outline-none focus:border-accent/60"
                      >
                        <option value="">Sem conta específica</option>
                        {contas.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome_exibicao || (c.natureza === "cartao" ? "Cartão" : "Conta")}
                            {c.natureza === "cartao" ? " (cartão)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditContaId(imp.id)
                      }}
                      className="hover:text-text hover:underline text-left"
                      title="Vincular esta importação a uma conta/cartão"
                    >
                      {imp.conta_nome || (imp.conta_natureza === "cartao" ? "Cartão" : "Banco")} ✏️
                    </button>
                  )}
                </Td>
                <Td className="font-mono text-text-dim">
                  {editMesId === imp.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="month"
                        value={mesInput}
                        onChange={(e) => setMesInput(e.target.value)}
                        className="bg-bg border border-line rounded px-1.5 py-1 text-[11px] text-text w-[120px]"
                      />
                      <button
                        onClick={() => mesInput && salvarMes.mutate({ id: imp.id, mes: mesInput })}
                        disabled={salvarMes.isPending}
                        className="text-accent text-[11px] hover:underline"
                      >
                        ok
                      </button>
                      <button onClick={() => setEditMesId(null)} className="text-text-faint text-[11px] hover:underline">×</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        abrirEditMes(imp)
                      }}
                      className="hover:text-text hover:underline"
                      title="Editar mês de referência"
                    >
                      {mesRefLabel(imp.mes_ref_inicio, imp.mes_ref_fim)} ✏️
                    </button>
                  )}
                </Td>
                <Td className="uppercase text-text-dim">{imp.formato_arquivo}</Td>
                <Td className="font-mono">
                  {imp.status === "erro"
                    ? imp.erro_detalhe || "—"
                    : imp.transacoes_importadas}
                  {imp.status !== "erro" && imp.transacoes_duplicadas > 0 && (
                    <span
                      className="text-text-faint cursor-help"
                      title="Lançamentos que já existiam no painel (mesma data, valor e descrição) e foram ignorados para não duplicar."
                    >
                      {" "}
                      (+{imp.transacoes_duplicadas} dup.)
                    </span>
                  )}
                </Td>
                <Td>
                  <Pill variant={STATUS_VARIANT[imp.status] || "neutral"}>{imp.status}</Pill>
                </Td>
                <Td className="text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm("Excluir esta importação e seus lançamentos?")) excluir.mutate(imp.id)
                    }}
                    className="text-red text-[12px] hover:underline"
                  >
                    Excluir
                  </button>
                </Td>
              </Tr>
            ))}
            {!importacoes.length && (
              <Tr>
                <Td colSpan={8} className="text-text-faint text-center py-6">
                  Nenhuma importação ainda.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
        {!!importacoes.length && (
          <p className="text-text-faint text-[11.5px] mt-3 leading-relaxed">
            Clique em uma importação para ver seus lançamentos. Toque no mês de referência ou na
            conta (✏️) para corrigi-los — vincular a fatura ao cartão certo faz o gasto abater do
            limite. <span className="text-text-dim">dup.</span> = lançamentos que já existiam no
            painel (mesma data, valor e descrição) e foram ignorados para não duplicar.
          </p>
        )}
      </Card>
    </div>
  )
}
