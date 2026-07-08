# Política Interna de Segurança e Acesso — AMplanejador

> ⚠️ MINUTA — documento interno. Descreve os controles hoje aplicados e as
> regras de acesso. Revisar com DPO/responsável técnico e atualizar quando os
> controles mudarem.

## 1. Controle de acesso (níveis)
A Plataforma tem **três níveis** isolados, cada um com login e token próprios:
- **Planejador** — acessa apenas os próprios clientes (isolado por RLS no banco).
- **Cliente final** — acessa apenas o próprio painel.
- **Negócio (admin)** — acesso operacional à plataforma; pode "entrar como" planejador/cliente para suporte.

Princípios: menor privilégio, segregação por papel, e nenhum nível aceita token de outro (validação por tipo no JWT).

## 2. Controles técnicos já implementados (no ar)
- **Senhas**: armazenadas só como *hash* bcrypt; política de senha mínima (8+, letra e número).
- **Isolamento multi-tenant**: Row-Level Security (RLS) no PostgreSQL em todas as tabelas; conexão privilegiada restrita a rotas que comprovadamente precisam.
- **Transporte**: HTTPS/TLS forçado (hospedagem).
- **Autenticação forte**: MFA/2FA (TOTP) no acesso administrativo.
- **Anti-força-bruta**: bloqueio após 5 tentativas por conta (15 min).
- **Auditoria**: log de ações administrativas e de **impersonação** ("entrar como").
- **Cabeçalhos de segurança** (API e frontend): CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy.
- **Webhook de pagamento**: token validado em tempo constante.
- **CI**: varredura de dependências vulneráveis (pip-audit).
- **Segredos**: fora do repositório (variáveis de ambiente).

## 3. Regras de acesso administrativo
- Acesso admin restrito às pessoas estritamente necessárias. 〔Listar quem tem.〕
- MFA recomendado/〔obrigatório〕 para todo admin.
- Toda impersonação fica registrada; usar só para suporte legítimo.
- Revisar acessos periodicamente e revogar ao desligar responsáveis.

## 4. Gestão de segredos
- Segredos (JWT_SECRET, chaves de API, DSN) apenas em variáveis de ambiente da hospedagem.
- 〔Definir rotina de rotação e responsável.〕

## 5. Pendências prioritárias
- **Backup** (Supabase Pro/PITR) — hoje inexistente no plano atual.
- **Monitoramento** (Sentry) — código pronto, falta ativar o DSN.
- **MFA obrigatório** no admin (hoje é opcional).
- Avaliar **MFA para planejador**.
- Rotina formal de revisão de acessos e rotação de segredos.

## 6. Responsáveis
- Segurança/DPO: 〔NOME〕 — 〔CONTATO〕
- Técnico: 〔NOME〕 — 〔CONTATO〕
