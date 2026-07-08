import LegalLayout, { H2 } from "./LegalLayout"

export default function PoliticaCookies() {
  return (
    <LegalLayout titulo="Política de Cookies e Armazenamento Local" atualizado="〔data〕">
      <p>
        Atualmente a Plataforma <strong>não usa cookies de análise, publicidade ou rastreamento de terceiros</strong>.
        Usamos apenas armazenamento local essencial no seu navegador para o serviço funcionar.
      </p>

      <H2>O que armazenamos</H2>
      <p>
        <strong>Token de sessão</strong> (localStorage): mantém você autenticado durante o uso. <strong>Preferências de
        interface</strong> (localStorage): lembram suas escolhas de exibição. Por serem estritamente necessários, não
        dependem de consentimento prévio (art. 7º, V, LGPD).
      </p>

      <H2>Fontes externas</H2>
      <p>
        Carregamos fontes tipográficas do Google Fonts (o navegador busca os arquivos em servidores do Google). Nenhum
        dado da sua conta é enviado nesse processo.
      </p>

      <H2>Como controlar</H2>
      <p>Você pode limpar o armazenamento local nas configurações do navegador — isso encerra a sessão e apaga as preferências.</p>

      <H2>Se adicionarmos analytics no futuro</H2>
      <p>
        Caso passemos a usar ferramentas de análise/marketing, implementaremos um banner de consentimento com opção de
        aceitar/recusar categorias não essenciais, e atualizaremos esta política.
      </p>

      <H2>Contato</H2>
      <p>〔e-mail do encarregado〕</p>
    </LegalLayout>
  )
}
