import { Link } from "react-router-dom"
import Logo from "../../components/ui/Logo"

// Layout público das páginas legais (Privacidade, Termos, Cookies, Canal LGPD).
// Mostra um aviso de "minuta em revisão" enquanto os textos não forem aprovados
// pelo jurídico — remover o banner (prop revisao={false}) quando publicar.
export default function LegalLayout({ titulo, atualizado, revisao = true, children }) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-line">
        <div className="max-w-[820px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-[13px] text-text-dim hover:text-text">← Início</Link>
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-6 py-12">
        {revisao && (
          <div className="mb-6 rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-3 text-amber text-[12.5px]">
            ⚠️ Documento preliminar em revisão jurídica — não é a versão final.
          </div>
        )}
        <h1 className="font-display text-[28px] font-bold mb-1">{titulo}</h1>
        {atualizado && <p className="text-text-faint text-[12px] mb-8">Última atualização: {atualizado}</p>}
        <div className="legal-prose text-text-dim text-[14px] leading-relaxed space-y-4">{children}</div>
      </main>

      <footer className="border-t border-line">
        <div className="max-w-[820px] mx-auto px-6 py-8 flex items-center gap-5 flex-wrap text-text-faint text-[12px]">
          <Link to="/privacidade" className="hover:text-text-dim">Privacidade</Link>
          <Link to="/termos" className="hover:text-text-dim">Termos de Uso</Link>
          <Link to="/cookies" className="hover:text-text-dim">Cookies</Link>
          <Link to="/lgpd" className="hover:text-text-dim">Canal LGPD</Link>
          <span className="ml-auto">© {new Date().getFullYear()} AMplanejador</span>
        </div>
      </footer>
    </div>
  )
}

// Helpers de composição (títulos de seção e parágrafos com o mesmo estilo).
export function H2({ children }) {
  return <h2 className="font-display text-[17px] font-semibold text-text mt-7 mb-1">{children}</h2>
}
