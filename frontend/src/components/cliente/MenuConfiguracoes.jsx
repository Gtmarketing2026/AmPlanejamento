import { useState } from "react"
import { createPortal } from "react-dom"
import ConfiguracoesTab from "../../pages/clienteFinal/tabs/ConfiguracoesTab"

// Engrenagem no topo (junto do perfil) que abre as Configurações num modal --
// substitui a antiga aba "Configurações".
export default function MenuConfiguracoes({ token }) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(true)}
        className="w-9 h-9 rounded-[8px] border border-line bg-panel flex items-center justify-center text-text-dim hover:text-text"
        title="Configurações"
      >
        <span className="text-[15px]">⚙️</span>
      </button>

      {aberto &&
        createPortal(
          // Portal pro <body>: a barra do topo usa backdrop-blur, e um
          // ancestral com backdrop-filter vira o "containing block" de
          // elementos position:fixed (bug conhecido do CSS) -- sem o
          // portal, esse modal ficava preso dentro da faixa estreita da
          // barra em vez de cobrir a tela toda.
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setAberto(false)}
          >
            <div
              className="bg-panel border border-line rounded-[14px] p-5 max-w-lg w-full mt-16"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-[16px] font-semibold">Configurações</h3>
                <button onClick={() => setAberto(false)} className="text-text-faint hover:text-text text-[15px]">
                  ✕
                </button>
              </div>
              <ConfiguracoesTab token={token} />
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
