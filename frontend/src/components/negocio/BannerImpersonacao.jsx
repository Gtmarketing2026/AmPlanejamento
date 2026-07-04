import { useNavigate } from "react-router-dom"

// Mostrado por cima do app real (planejador ou cliente final) enquanto o
// admin está "entrado como" essa conta -- o token do admin (fluxo_admin_token)
// nunca sai do localStorage nesse meio tempo, então voltar é só navegar de
// volta. NÃO limpamos o token/perfil impersonado aqui (nem o flag de
// impersonação): se fizermos isso antes da navegação terminar, o
// ProtectedRoute (que redireciona pro /login assim que o perfil vira null)
// ainda está montado e vence a corrida contra o navigate. A limpeza de
// verdade acontece no mount do NegocioLayout, usando o flag de impersonação
// como sinal de "preciso limpar" -- só quando já é garantido que saímos da
// árvore do ProtectedRoute.
export default function BannerImpersonacao({ nome }) {
  const navigate = useNavigate()

  function voltar() {
    navigate("/negocio/planejadores", { replace: true })
  }

  return (
    <div className="sticky top-0 z-50 bg-blue/15 border-b border-blue/40 px-6 py-2 flex items-center justify-between text-[12.5px]">
      <span className="text-blue font-medium">
        🏢 Você está entrando como <strong>{nome}</strong>, via Painel do Negócio.
      </span>
      <button onClick={voltar} className="px-3 py-1.5 rounded-[7px] bg-blue/20 text-blue hover:bg-blue/30 font-medium">
        ← Voltar ao Painel do Negócio
      </button>
    </div>
  )
}
