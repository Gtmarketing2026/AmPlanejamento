import { useMemo, useState } from "react"
import Button from "./Button"

// Dicas curtas por subcategoria (o que costuma entrar em cada uma) -- ajudam a
// pessoa a classificar sem precisar adivinhar. Chave = nome da subcategoria.
// Nomes repetidos entre categorias (ex: "Casa" em Despesas e em Projetos)
// compartilham a mesma dica -- é próximo o suficiente.
const DICAS_SUBCATEGORIA = {
  // Classificação neutra
  "Despesas reembolsáveis": "Gastos que serão devolvidos depois",
  "Pagamento fatura de cartão": "Quitação da fatura do cartão",
  Reembolsos: "Valores devolvidos a você",
  "Resgate de investimentos": "Dinheiro que saiu de aplicações",
  "Sem classificação": "Não entra em receitas nem despesas",
  "Transferência mesma titularidade": "Entre suas próprias contas",
  // Despesas não obrigatórias
  "Assinaturas e serviços": "Streaming, apps, clubes",
  Compras: "Marketplaces, lojas em geral",
  Esportes: "Academia, crossfit, pilates",
  Lazer: "Cinema, shows, games, passeios",
  Outros: "Gastos variados",
  "Presentes e doações": "Presentes, doação, dízimo",
  Restaurantes: "Restaurante, bar, delivery, iFood",
  "Roupas e acessórios": "Vestuário, calçados, acessórios",
  "Tarifas bancárias": "Tarifas, anuidade, taxas do banco",
  Viagens: "Passagens, hospedagem, turismo",
  // Despesas obrigatórias
  Alimentação: "Refeições do dia a dia",
  Casa: "Aluguel, condomínio, água, luz, gás, internet",
  "Casa de veraneio": "Segunda casa / imóvel de lazer",
  "Cuidados pessoais": "Salão, barbearia, estética",
  "Despesas médicas": "Consultas, exames, procedimentos",
  Educação: "Escola, faculdade, cursos, material",
  "Filhos e família": "Gastos com filhos e dependentes",
  "Impostos e taxas": "Impostos, juros, IPTU, IPVA, DETRAN",
  Mercado: "Supermercado, feira, açougue, padaria",
  Pets: "Pet shop, veterinário, ração",
  "Prestadores de serviço": "Diarista, encanador, técnico",
  Profissional: "Gastos ligados ao trabalho",
  Saúde: "Farmácia, plano de saúde, remédios",
  Seguros: "Seguro auto, vida, residencial",
  "Serviços financeiros": "Boletos, serviços do banco",
  Transporte: "Uber, combustível, ônibus, pedágio",
  // Dívidas
  "Dívidas e empréstimos": "Empréstimo, consignado, renegociação",
  // Empresa e autônomo
  Colaboradores: "Salários, pró-labore, comissões",
  Ferramentas: "Softwares e ferramentas de trabalho",
  Infraestrutura: "Aluguel, energia, estrutura da empresa",
  "Insumos e outros": "Matéria-prima, estoque, embalagem",
  Marketing: "Anúncios, tráfego pago, mídia",
  "Meios de pagamento": "Maquininha, taxas de venda",
  "Taxas e impostos": "DAS, tributos, contador, CNPJ",
  // Financiamentos
  "Financiamento imobiliário": "Parcela de imóvel/habitação",
  "Financiamento veículo": "Parcela de carro/moto",
  // Investimentos
  "Aplicação em investimentos": "Dinheiro aplicado (vira patrimônio)",
  // Projetos (objetivos)
  Eletrônicos: "Objetivo: eletrônicos",
  Família: "Objetivo: família",
  Hobby: "Objetivo: hobby",
  Veículo: "Objetivo: veículo",
  Viagem: "Objetivo: viagem",
  // Renda
  "Outras fontes de renda": "Aluguel, rendimentos, etc",
  Renda: "Salário, VA/VR/VT, comissões, bônus",
  "Renda cônjuge": "Salário, VA/VR/VT, comissões, bônus",
}

// Chip clicável (ícone + categoria em cima, subcategoria embaixo) que abre um
// modal pra trocar a categoria/subcategoria do lançamento -- usado tanto no
// painel do cliente quanto na visão do planejador por cliente. O modal mostra
// categorias como chips e subcategorias como linhas com uma dica curta embaixo,
// pra ajudar a classificar.
export default function EditorCategoria({
  categoriaId,
  subcategoriaId,
  categorias,
  subcategorias,
  disabled,
  onChange,
}) {
  const [aberto, setAberto] = useState(false)
  const [catTemp, setCatTemp] = useState(categoriaId || "")
  const [subTemp, setSubTemp] = useState(subcategoriaId || "")
  const [aplicarTodos, setAplicarTodos] = useState(false)

  const categoria = categorias?.find((c) => c.id === categoriaId)
  const subcategoria = subcategorias?.find((s) => s.id === subcategoriaId)
  const catTempObj = categorias?.find((c) => c.id === catTemp)
  const subcategoriasDaCategoriaTemp = useMemo(
    () => (subcategorias || []).filter((s) => s.categoria_id === catTemp),
    [subcategorias, catTemp]
  )

  function abrir() {
    setCatTemp(categoriaId || "")
    setSubTemp(subcategoriaId || "")
    setAplicarTodos(false)
    setAberto(true)
  }

  function salvar() {
    onChange({
      categoria_id: catTemp || null,
      subcategoria_id: subTemp || null,
      aplicar_a_todos_iguais: aplicarTodos,
    })
    setAberto(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={disabled}
        className="flex items-center gap-2 text-left px-2 py-1 rounded-[7px] hover:bg-panel-2 disabled:opacity-50"
      >
        <span className="text-[15px]">{categoria?.icone || "🏷️"}</span>
        <div className="leading-tight">
          <div className="text-[12.5px] text-text">{categoria?.nome || "Sem categoria"}</div>
          <div className="text-[10.5px] text-text-faint">{subcategoria?.nome || "Sem classificação"}</div>
        </div>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="bg-panel border border-line rounded-[14px] p-5 max-w-md w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="font-display text-[15px] font-semibold">Categorizar lançamento</h3>
              <button onClick={() => setAberto(false)} className="text-text-faint hover:text-text">
                ✕
              </button>
            </div>

            {/* Categorias como chips */}
            <div className="flex flex-wrap gap-1.5 mb-4 shrink-0">
              {categorias?.map((c) => {
                const ativo = c.id === catTemp
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCatTemp(c.id)
                      setSubTemp("")
                    }}
                    className={`px-2.5 py-1.5 rounded-full text-[12px] border transition-colors ${
                      ativo
                        ? "bg-accent text-[#062019] border-accent font-semibold"
                        : "border-line text-text-dim hover:text-text hover:border-text-faint"
                    }`}
                  >
                    {c.icone ? `${c.icone} ` : ""}
                    {c.nome}
                  </button>
                )
              })}
            </div>

            {/* Subcategorias como linhas, com dica curta embaixo */}
            <div className="flex-1 overflow-y-auto -mx-1 px-1 mb-4">
              {!catTemp ? (
                <p className="text-text-faint text-[12.5px] py-3">Escolha uma categoria acima.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <LinhaSub
                    nome="Sem classificação"
                    dica="Deixar sem subcategoria"
                    icone={catTempObj?.icone}
                    ativo={!subTemp}
                    onClick={() => setSubTemp("")}
                  />
                  {subcategoriasDaCategoriaTemp.map((s) => (
                    <LinhaSub
                      key={s.id}
                      nome={s.nome}
                      dica={DICAS_SUBCATEGORIA[s.nome]}
                      icone={catTempObj?.icone}
                      ativo={s.id === subTemp}
                      onClick={() => setSubTemp(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 mb-4 text-[12.5px] text-text-dim cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={aplicarTodos}
                onChange={(e) => setAplicarTodos(e.target.checked)}
                className="accent-accent"
              />
              Aplicar a todos os lançamentos com esta descrição
            </label>

            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={salvar}>Salvar</Button>
              <Button variant="ghost" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Linha de subcategoria: ícone + nome + dica curta embaixo. Destaca a ativa.
function LinhaSub({ nome, dica, icone, ativo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[9px] text-left transition-colors ${
        ativo ? "bg-accent/12 border border-accent/40" : "border border-transparent hover:bg-panel-2"
      }`}
    >
      <span className="text-[15px] shrink-0">{icone || "🏷️"}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className={`text-[13px] ${ativo ? "text-text font-medium" : "text-text-dim"}`}>{nome}</div>
        {dica && <div className="text-[10.5px] text-text-faint truncate">{dica}</div>}
      </div>
      {ativo && <span className="text-accent text-[13px] shrink-0">✓</span>}
    </button>
  )
}
