import { useQuery } from "@tanstack/react-query"
import Card from "../../components/ui/Card"
import Termometro from "../../components/ui/Termometro"
import { obterMinhaSaudeFinanceira } from "../../api/patrimonio"

const FAIXAS = [
  { max: 20, label: "Atenção" },
  { max: 40, label: "Regular" },
  { max: 60, label: "Neutro" },
  { max: 80, label: "Bom" },
  { max: 101, label: "Ótimo" },
]

function rotuloDoScore(score) {
  return FAIXAS.find((f) => score < f.max)?.label || "—"
}

export default function SaudeFinanceiraCard({ token }) {
  const { data, isLoading } = useQuery({
    queryKey: ["cliente-eu-saude-financeira", token],
    queryFn: () => obterMinhaSaudeFinanceira(token),
    enabled: !!token,
  })

  if (isLoading || !data) return null

  const linkPlanejador = data.planejador_whatsapp
    ? `https://wa.me/55${data.planejador_whatsapp.replace(/\D/g, "")}`
    : null

  return (
    <Card className="mb-5">
      <Termometro score={data.score} semDados={!data.tem_dados} label={rotuloDoScore(data.score)} />

      {data.mensagens.length > 0 && (
        <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-line">
          {data.mensagens.map((m, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="text-[15px] mt-0.5">{m.tipo === "alerta" ? "⚠️" : "✅"}</span>
                <p className={`text-[12.5px] leading-relaxed ${m.tipo === "alerta" ? "text-text-dim" : "text-accent"}`}>
                  {m.texto}
                </p>
              </div>
              {m.tipo === "alerta" && linkPlanejador && (
                <a
                  href={linkPlanejador}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent text-[12px] font-semibold whitespace-nowrap hover:underline"
                >
                  Falar com planejador
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
