import { useNavigate } from "react-router-dom"
import { getImpersonacaoOrigem } from "../../lib/impersonacao"

// Mostrado por cima do app real enquanto se está "entrando como" / "vendo o
// painel de" outra conta. NÃO limpamos token/flag aqui: se fizermos isso antes
// da navegação terminar, o guard do layout atual reage ao token virar null e
// compete com o navigate. A limpeza real acontece no mount do layout de
// destino (NegocioLayout para o admin; AppLayout para o planejador).
export default function BannerImpersonacao({ nome }) {
  const navigate = useNavigate()
  const origem = getImpersonacaoOrigem()
  const doPlanejador = origem === "planejador"

  function voltar() {
    navigate(doPlanejador ? "/clientes" : "/negocio/planejadores", { replace: true })
  }

  return (
    <div className="relative z-30 bg-blue/15 border-b border-blue/40 px-6 py-2 flex items-center justify-between gap-3 flex-wrap text-[12.5px]">
      <span className="text-blue font-medium">
        {doPlanejador ? (
          <>👁️ Você está vendo o painel do cliente <strong>{nome}</strong>.</>
        ) : (
          <>🏢 Você está entrando como <strong>{nome}</strong>, via Painel do Negócio.</>
        )}
      </span>
      <button onClick={voltar} className="px-3 py-1.5 rounded-[7px] bg-blue/20 text-blue hover:bg-blue/30 font-medium">
        {doPlanejador ? "← Voltar aos meus clientes" : "← Voltar ao Painel do Negócio"}
      </button>
    </div>
  )
}
