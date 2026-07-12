# Registro das Operações de Tratamento (ROPA) — AMplanejador

> ⚠️ MINUTA — documento interno (art. 37 da LGPD). Revisar com jurídico/DPO e
> manter atualizado a cada nova operação de tratamento.

**Controlador:** GT - MARKETING DIGITAL LTDA — CNPJ 43.430.988/0001-31
**Encarregado (DPO):** Andreia Michele Menezes Luz — andreia.contabilrj@gmail.com
**Atualizado em:** 11 de julho de 2026

## Como ler
Cada linha é uma operação de tratamento. "Papel" indica se, naquela operação, a Plataforma atua como **Controladora (C)** ou **Operadora (O)**.

| # | Operação | Categorias de dados | Titulares | Finalidade | Base legal | Papel | Operadores/Destinatários | Transf. internacional | Retenção |
|---|----------|--------------------|-----------|-----------|-----------|-------|--------------------------|----------------------|----------|
| 1 | Cadastro e autenticação do planejador | Nome, e-mail, WhatsApp, empresa, senha (hash) | Planejadores | Criar/manter conta, login | Execução de contrato | C | Supabase | Sim (EUA) | Enquanto conta ativa + prazo legal |
| 2 | Cobrança/assinatura | Dados de cobrança, identificação | Planejadores | Cobrar assinatura | Execução de contrato | C | Asaas | Não | Prazo fiscal/legal |
| 3 | Cadastro do cliente final | Nome, CPF, CNPJ, apelido, senha (hash), perfil, objetivos, histórico | Clientes finais | Prestar o serviço ao planejador | Execução de contrato (planejador) | O | Supabase | Sim (EUA) | Enquanto conta do planejador ativa |
| 4 | Importação de extratos/faturas | Lançamentos, valores, datas, estabelecimentos, dados de conta/cartão | Clientes finais | Organizar finanças | Execução de contrato | O | Supabase (banco + storage) | Sim (EUA) | Idem |
| 5 | Classificação por IA | Descrição do lançamento | Clientes finais | Categorizar automaticamente | Legítimo interesse / execução | O | OpenAI | Sim (EUA) | Não retido pelo provedor além da requisição¹ |
| 6 | Metas, patrimônio, dívidas, investimentos | Dados financeiros declarados | Clientes finais | Planejamento | Execução de contrato | O | Supabase | Sim (EUA) | Idem |
| 7 | CRM + Google Agenda | Nome do cliente, follow-ups, eventos | Clientes finais | Relacionamento/agendamento | Legítimo interesse / consentimento (conexão Google) | O | Google | Sim (EUA) | Enquanto conexão ativa |
| 8 | Open Finance (quando ativado) | Dados bancários (leitura) | Clientes finais | Conciliação automática | **Consentimento** | O | Pluggy | Não | Enquanto consentimento vigente |
| 9 | Segurança/auditoria | IP, tentativas de login, logs de ação/impersonação | Todos | Proteger o sistema | Legítimo interesse / obrigação legal | C | Supabase | Sim (EUA) | 〔definir, ex. 6–12 meses〕 |
| 10 | Monitoramento de erros (quando ativado) | Metadados de exceção (sem PII por padrão) | Todos | Estabilidade | Legítimo interesse | C | Sentry | Sim (EUA) | Conforme retenção do provedor |

¹ 〔Confirmar política de retenção/treinamento do provedor de IA no contrato (API não usada para treinamento por padrão).〕

## Medidas de segurança aplicáveis a todas as operações
Ver [Política interna de segurança](politica-interna-seguranca.md): criptografia de senha, RLS multi-tenant, TLS, MFA admin, rate limiting, cabeçalhos de segurança, controle de acesso por papéis, auditoria de impersonação.

## Pendências para completar o ROPA
- 〔Definir prazos exatos de retenção por categoria.〕
- 〔Anexar DPAs assinados dos operadores (ver dpa-fornecedores.md).〕
- 〔Confirmar hipótese de transferência internacional aplicável (art. 33).〕
