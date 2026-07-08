import LegalLayout, { H2 } from "./LegalLayout"

export default function TermosUso() {
  return (
    <LegalLayout titulo="Termos de Uso" atualizado="〔data〕">
      <p>
        Estes Termos regem o uso do <strong>AMplanejador</strong>, operado por 〔razão social〕, CNPJ 〔CNPJ〕. Ao criar
        conta ou usar o serviço, você concorda com eles.
      </p>

      <H2>1. Objeto</H2>
      <p>
        Ferramentas para o planejador organizar, importar, categorizar e acompanhar dados financeiros de seus clientes:
        dashboard, importação de extratos, metas, patrimônio, CRM e, conforme o plano, marca própria e Open Finance.
      </p>

      <H2>2. Cadastro e acesso</H2>
      <p>
        Você é responsável pela veracidade dos dados e pelo sigilo das credenciais. O planejador é responsável por ter
        base legal e autorização para inserir e tratar os dados de seus clientes finais. É proibido compartilhar
        credenciais ou tentar acessar dados de terceiros.
      </p>

      <H2>3. Planos, cobrança e cancelamento</H2>
      <p>
        Os planos e valores vigentes são exibidos na Plataforma; o plano base inclui uma quantidade de clientes e
        adicionais podem gerar cobrança extra. A assinatura é mensal, sem fidelidade, e pode ser cancelada a qualquer
        momento (evita ciclos futuros, sem reembolso de período já usado, salvo disposição legal).
      </p>

      <H2>4. Natureza do serviço</H2>
      <p>
        A Plataforma é uma ferramenta de organização financeira. Não presta consultoria de investimentos nem substitui a
        análise do planejador. Projeções e simulações são estimativas e não garantem resultados.
      </p>

      <H2>5. Responsabilidades e limitações</H2>
      <p>
        Use conforme a lei. Confira os dados importados/classificados por IA (auxílio que pode conter imprecisões). Nos
        limites da lei, não nos responsabilizamos por decisões tomadas com base nos dados, por indisponibilidade de
        terceiros ou por uso indevido de credenciais.
      </p>

      <H2>6. Privacidade</H2>
      <p>O tratamento de dados segue a Política de Privacidade, parte integrante destes Termos.</p>

      <H2>7. Alterações e foro</H2>
      <p>Podemos alterar estes Termos, com aviso pelos canais da Plataforma. Foro de 〔comarca〕, salvo regra legal em contrário.</p>
    </LegalLayout>
  )
}
