import LegalLayout, { H2 } from "./LegalLayout"

export default function PoliticaPrivacidade() {
  return (
    <LegalLayout titulo="Política de Privacidade" atualizado="11 de julho de 2026">
      <p>
        Esta Política explica como o <strong>AMplanejador</strong> (GT - MARKETING DIGITAL LTDA, CNPJ 43.430.988/0001-31) trata dados
        pessoais, conforme a Lei nº 13.709/2018 (LGPD).
      </p>

      <H2>1. A quem se aplica</H2>
      <p>
        A <strong>planejadores</strong> (profissionais que assinam a Plataforma) e a <strong>clientes finais</strong>
        (pessoas acompanhadas pelo planejador). A Plataforma é <strong>Controladora</strong> dos dados de cadastro e
        pagamento dos planejadores e <strong>Operadora</strong> dos dados financeiros dos clientes finais, tratados por
        conta e ordem do planejador.
      </p>

      <H2>2. Dados que coletamos</H2>
      <p>
        <strong>Do planejador:</strong> nome, e-mail, WhatsApp, empresa, subdomínio, senha (apenas como hash), dados de
        cobrança. <strong>Do cliente final:</strong> nome, CPF, CNPJ (quando houver), apelido de acesso, senha (hash),
        perfil, objetivos, histórico e dados financeiros (lançamentos, saldos, contas, cartões, investimentos, dívidas,
        metas e patrimônio, inclusive extraídos de extratos/faturas enviados). <strong>Automaticamente:</strong> dados
        técnicos mínimos e registros de segurança (ver a Política de Cookies).
      </p>

      <H2>3. Para que usamos</H2>
      <p>
        Prestar o serviço (execução de contrato); classificar lançamentos por IA (execução/legítimo interesse);
        autenticação e segurança (legítimo interesse/obrigação legal); cobrança (execução de contrato); conexão via Open
        Finance, quando ativada (consentimento); e cumprir obrigações legais.
      </p>

      <H2>4. Compartilhamento (operadores)</H2>
      <p>
        Não vendemos dados. Usamos prestadores necessários à operação, sob contrato: Supabase (banco/arquivos), Vercel
        (hospedagem), OpenAI (classificação por IA — só a descrição do lançamento, sem CPF), Asaas (pagamento), Google
        (Agenda/CRM) e Pluggy (Open Finance, quando ativado).
      </p>

      <H2>5. Transferência internacional</H2>
      <p>Parte dos dados é tratada por operadores no exterior (EUA), com salvaguardas contratuais e nas hipóteses da LGPD.</p>

      <H2>6. Segurança</H2>
      <p>
        Senhas em hash (bcrypt), isolamento de dados por cliente (RLS), HTTPS/TLS, verificação em duas etapas no acesso
        administrativo, limitação de tentativas de login, cabeçalhos de segurança e política de senha.
      </p>

      <H2>7. Retenção</H2>
      <p>Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário às finalidades e a obrigações legais.</p>

      <H2>8. Seus direitos</H2>
      <p>
        Confirmação, acesso, correção, anonimização/eliminação, portabilidade, informação sobre compartilhamento e
        revogação de consentimento (art. 18 da LGPD). Solicite pelo Canal LGPD.
      </p>

      <H2>9. Encarregado (DPO) e contato</H2>
      <p>Andreia Michele Menezes Luz — <strong>andreia.contabilrj@gmail.com</strong>.</p>
    </LegalLayout>
  )
}
