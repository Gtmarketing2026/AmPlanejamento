# Política de Privacidade — AMplanejador

> ⚠️ MINUTA — revisar com jurídico e preencher os campos 〔…〕 antes de publicar.

**Última atualização:** 11 de julho de 2026

Esta Política explica como o **AMplanejador** (GT - MARKETING DIGITAL LTDA, CNPJ 43.430.988/0001-31, com sede em 〔ENDEREÇO〕), doravante "Plataforma", trata dados pessoais, em conformidade com a Lei nº 13.709/2018 (LGPD).

## 1. A quem esta Política se aplica
- **Planejadores** — profissionais que assinam a Plataforma.
- **Clientes finais** — pessoas cujos dados financeiros são acompanhados pelo planejador dentro da Plataforma.

**Papéis:** a Plataforma é **Controladora** dos dados de cadastro e pagamento dos planejadores; e **Operadora** dos dados financeiros dos clientes finais, tratados por conta e ordem do planejador (que é o Controlador dessa relação). Dúvidas sobre o tratamento feito pelo seu planejador devem ser direcionadas a ele; dúvidas sobre a Plataforma, ao nosso Encarregado (seção 10).

## 2. Dados que coletamos
**Do planejador (no cadastro e uso):** nome, e-mail, WhatsApp, nome da empresa, subdomínio, senha (armazenada apenas como *hash*), dados de cobrança/assinatura.

**Do cliente final (inseridos pelo planejador ou importados):** nome, CPF, CNPJ (quando houver), apelido de acesso, senha (*hash*), perfil comportamental, objetivos, histórico e **dados financeiros** — lançamentos, saldos, contas, cartões, investimentos, dívidas, metas e patrimônio, inclusive os extraídos de extratos/faturas enviados (PDF/OFX/CSV).

**Automaticamente:** dados técnicos mínimos de funcionamento (registro de acesso, endereço IP em logs de segurança). Ver a [Política de Cookies](politica-de-cookies.md).

## 3. Para que usamos (finalidades e bases legais)
| Finalidade | Base legal (LGPD) |
|-----------|-------------------|
| Prestar o serviço de planejamento financeiro (dashboard, importação, relatórios) | Execução de contrato (art. 7º, V) |
| Classificar automaticamente lançamentos por IA | Execução de contrato / legítimo interesse (art. 7º, IX) |
| Autenticação, segurança e prevenção a fraude | Legítimo interesse / cumprimento de obrigação legal |
| Cobrança e gestão da assinatura do planejador | Execução de contrato |
| Conexão bancária via Open Finance (quando ativada) | **Consentimento** do titular (art. 7º, I) |
| Cumprir obrigações legais/regulatórias e responder autoridades | Obrigação legal (art. 7º, II) |

## 4. Compartilhamento e operadores (sub-processadores)
Não vendemos dados. Compartilhamos com prestadores estritamente necessários à operação, sob contrato:

| Fornecedor | Finalidade | Local |
|-----------|-----------|-------|
| Supabase | Banco de dados e armazenamento de arquivos | Exterior (EUA) |
| Vercel | Hospedagem da aplicação | Exterior (EUA) |
| OpenAI | Classificação automática de lançamentos por IA¹ | Exterior (EUA) |
| Asaas | Processamento de pagamento (assinatura do planejador) | Brasil |
| Google | Sincronização com Google Agenda (CRM), quando o planejador conecta | Exterior (EUA) |
| Pluggy | Open Finance / conexão bancária (quando ativado) | Brasil |

¹ Na classificação por IA, a descrição do lançamento pode ser enviada ao provedor para categorização. Não enviamos CPF nem credenciais bancárias para esse fim.

## 5. Transferência internacional
Parte dos dados é tratada por operadores no exterior (EUA). A transferência ocorre com base nas hipóteses da LGPD (art. 33), com salvaguardas contratuais junto aos fornecedores. 〔Confirmar cláusulas contratuais com jurídico.〕

## 6. Segurança
Adotamos medidas técnicas e organizacionais, incluindo: criptografia de senhas (*bcrypt*), isolamento de dados por cliente no banco (RLS), criptografia em trânsito (HTTPS/TLS), verificação em duas etapas no acesso administrativo, limitação de tentativas de login, cabeçalhos de segurança e política de senha. Ver a [Política interna de segurança](politica-interna-seguranca.md).

## 7. Retenção
Mantemos os dados enquanto a conta estiver ativa e pelo prazo necessário às finalidades e a obrigações legais. Encerrada a relação, os dados são eliminados ou anonimizados nos prazos definidos, salvo guarda obrigatória por lei. 〔Definir prazos específicos com jurídico.〕

## 8. Direitos do titular
Você pode solicitar: confirmação de tratamento, acesso, correção, anonimização/eliminação, portabilidade, informação sobre compartilhamento e revogação de consentimento (art. 18 da LGPD). Pedidos pelo [Canal LGPD](canal-lgpd.md). Para clientes finais, alguns pedidos podem ser atendidos primeiro pelo planejador (Controlador).

## 9. Crianças e adolescentes
A Plataforma não se destina a menores de 18 anos.

## 10. Encarregado (DPO) e contato
**Encarregado:** Andreia Michele Menezes Luz — **andreia.contabilrj@gmail.com**. Também via [Canal LGPD](canal-lgpd.md).

## 11. Alterações
Podemos atualizar esta Política; a data de vigência acima indica a versão atual. Mudanças relevantes serão comunicadas pelos canais da Plataforma.
