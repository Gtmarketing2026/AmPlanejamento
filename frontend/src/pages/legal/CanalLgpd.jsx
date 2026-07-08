import LegalLayout, { H2 } from "./LegalLayout"

export default function CanalLgpd() {
  return (
    <LegalLayout titulo="Canal LGPD — Seus direitos" atualizado="〔data〕">
      <p>
        Levamos a sério a proteção dos seus dados. Por este canal você fala diretamente com nosso Encarregado (DPO) para
        exercer seus direitos ou tirar dúvidas sobre o tratamento dos seus dados pessoais.
      </p>

      <div className="rounded-[10px] border border-line bg-panel px-5 py-4 my-5">
        <div className="text-[12px] text-text-faint uppercase tracking-wide font-mono mb-1">Encarregado (DPO)</div>
        <div className="text-text font-medium">〔nome do encarregado〕</div>
        <a href="mailto:〔e-mail do encarregado〕" className="text-accent font-mono text-[13.5px]">〔e-mail do encarregado〕</a>
      </div>

      <H2>Direitos que você pode exercer</H2>
      <p>
        Confirmação da existência de tratamento; acesso aos dados; correção; anonimização, bloqueio ou eliminação;
        portabilidade; informação sobre com quem compartilhamos; e revogação de consentimento (art. 18 da LGPD).
      </p>

      <H2>Como solicitar</H2>
      <p>
        Envie um e-mail ao Encarregado descrevendo o pedido. Podemos solicitar informações para confirmar sua identidade
        (para não entregar seus dados a terceiros). Responderemos dentro do prazo legal.
      </p>

      <H2>Se você é cliente de um planejador</H2>
      <p>
        Alguns pedidos podem ser atendidos primeiro pelo seu <strong>planejador</strong>, que é o responsável (Controlador)
        pela relação com você. Podemos orientar o encaminhamento correto.
      </p>
    </LegalLayout>
  )
}
