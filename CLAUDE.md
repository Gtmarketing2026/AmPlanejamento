# Fluxo — App de Planejamento Financeiro (B2B2C)

## O que é este projeto

App de planejamento financeiro por assinatura. Modelo B2B2C: planejadores
financeiros (profissionais) assinam a plataforma e gerenciam os próprios
clientes finais dentro dela. Conciliação bancária via Open Finance (Plano
Completo) ou upload manual de extrato/fatura (Plano Essencial).

## Estado atual do projeto (o que já existe vs. o que falta)

**Já existe:**
- `schema_seguranca.sql` — schema completo do Postgres, com RLS multi-tenant,
  idempotência de cobrança, dedup de transação, auditoria, taxonomia de
  categorias/subcategorias/instituições/tags (com seed de dados padrão),
  campos de integração com Asaas (`asaas_customer_id`, `asaas_subscription_id`,
  `asaas_payment_id`)
- `app/` — esqueleto do backend em FastAPI (auth, clientes, faturas, job de
  faturamento, webhook do Asaas) — funcional mas parcial
- `app/integrations/asaas.py` — cliente da API do Asaas (criar customer,
  criar/atualizar/cancelar subscription, listar payments, validar webhook)
- `app/api/routes/webhooks.py` — recebe eventos PAYMENT_* do Asaas
- `fluxo-app.html` — **wireframe de referência visual** (HTML/CSS/JS puro,
  sem framework). NÃO é o frontend final, é a especificação de design:
  paleta de cores, tipografia, estrutura de navegação, layout de cada tela.
  Use como fonte da verdade para como o produto deve parecer e se comportar.
- `testar_pluggy.py` — script de validação da API da Pluggy (Open Finance)

**NÃO existe ainda (é o que precisa ser construído):**
- Frontend real (React/Vue/etc.) consumindo a API — hoje só há o wireframe estático
- Maioria dos endpoints da API (categorias, subcategorias, instituições, tags,
  transações, metas, CRM, importação de extrato, painel analítico)
- **Fluxo de cadastro completo com Asaas**: a rota de signup hoje só cria o
  Profissional — falta criar o customer no Asaas, criar o registro de
  Assinatura, e coletar a forma de pagamento (checkout). Ver TODO em
  `app/api/routes/auth.py`.
- **Régua de inadimplência automatizada**: o webhook já marca fatura como
  "atrasada" no evento PAYMENT_OVERDUE, mas ainda não dispara o congelamento
  D+5 / cancelamento D+35 — isso precisa de um job (`jobs/inadimplencia.py`,
  a criar) rodando diariamente
- Parsers de OFX/CSV/PDF para o Plano Essencial
- Integração real com Pluggy (só o script de teste existe)
- Autenticação completa do fluxo do cliente final (consentimento Open Finance)
- Deploy em produção (ver seção "Deploy na web" abaixo pro caminho recomendado)
- Scheduler para os jobs rodarem sozinhos (hoje são scripts manuais)
- Testes automatizados

## Pagamento — Asaas

O gateway escolhido é o **Asaas** (Instituição de Pagamento regulada pelo
Bacen, API REST, sem mensalidade fixa). Pontos importantes:

- **Sandbox primeiro**: `ASAAS_ENV=sandbox` aponta pra
  `api-sandbox.asaas.com` — criar conta em https://sandbox.asaas.com pra
  pegar a API key de teste antes de qualquer coisa em produção
- **Assinatura (subscription) ≠ cobrança (payment)**: a subscription é a
  configuração recorrente; cada payment é uma cobrança individual gerada
  automaticamente a cada ciclo. `faturas.asaas_payment_id` rastreia o
  payment; `assinaturas.asaas_subscription_id` rastreia a subscription.
- **Não existe webhook de subscription** — só de payment. O webhook em
  `app/api/routes/webhooks.py` já lida com isso via o campo `subscription`
  dentro do payload de payment.
- **Webhook precisa de token configurado no painel do Asaas**, igual ao
  valor de `ASAAS_WEBHOOK_TOKEN` no `.env` — sem isso, qualquer um que
  descobrir a URL do webhook pode forjar confirmação de pagamento.
- **Atualizar valor da subscription só afeta cobranças futuras** — se
  precisar corrigir uma fatura já gerada, é outro endpoint (não implementado
  aqui ainda).

## Deploy na web — GitHub + Supabase + Vercel + Asaas

O usuário já tem conta nos quatro. Esse é o caminho concreto, não genérico:

1. **GitHub**: criar repositório e dar push no código (o `.gitignore` já
   exclui `.env`, `venv/`, `__pycache__/`)
2. **Supabase**: criar um projeto novo → aplicar `schema_seguranca.sql` via
   SQL Editor do próprio Supabase (copiar/colar o arquivo inteiro e rodar) →
   pegar a connection string em Project Settings > Database
   - **Importante**: usar a string de **Connection Pooling** (porta 6543,
     modo transaction), não a conexão direta (porta 5432) — deploy
     serverless na Vercel abre conexão nova a cada invocação, e a conexão
     direta do Postgres esgota rápido. O `get_db_com_rls` já usa `SET
     LOCAL` (não `SET`) justamente porque é compatível com pooling em modo
     transaction — não trocar isso por `SET` comum.
   - **Crítico — não pular**: a role `postgres` do Supabase tem o atributo
     `BYPASSRLS` (confirmado rodando `SELECT rolbypassrls FROM pg_roles
     WHERE rolname = current_user`) — ela ignora TODAS as policies de RLS,
     mesmo não sendo superuser. Se `DATABASE_URL` conectar como `postgres`,
     o isolamento multi-tenant simplesmente não existe, mesmo com RLS
     "ativado" no schema. É preciso criar uma role de aplicação separada,
     sem `BYPASSRLS`, e usar ela em `DATABASE_URL`:
     ```sql
     CREATE ROLE app_fluxo LOGIN PASSWORD '<senha forte>' NOSUPERUSER NOBYPASSRLS;
     GRANT USAGE ON SCHEMA public TO app_fluxo;
     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_fluxo;
     GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_fluxo;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_fluxo;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_fluxo;
     ```
     No pooler do Supabase (Supavisor), o usuário dessa role na connection
     string vira `app_fluxo.<project_ref>` (mesmo padrão do `postgres.<project_ref>`).
   - **Duas connection strings, não uma**: `DATABASE_URL` (role `app_fluxo`,
     restrita, respeita RLS — usada em `get_db_com_rls`, toda rota que serve
     dado de tenant) e `DATABASE_URL_ADMIN` (role `postgres`, ignora RLS —
     usada em `get_db_sem_rls` para login/cadastro, no webhook do Asaas, e na
     varredura cross-tenant do job de faturamento). O motivo: a tabela
     `profissionais` também tem RLS, e login precisa buscar por e-mail antes
     de saber o `profissional_id` — com a role restrita essa busca sempre
     voltaria vazia. Ver `app/db/base.py` (`SessionLocal` vs
     `SessionLocalAdmin`) e `.env.example`.
3. **Vercel**: importar o repositório do GitHub. O projeto já tem
   `vercel.json` e `pyproject.toml` configurados com o entrypoint
   (`app.main:app`) — a Vercel detecta FastAPI automaticamente. Configurar
   as variáveis de ambiente do `.env.example` no painel do projeto (Settings
   > Environment Variables), incluindo `DATABASE_URL` do Supabase.
4. **Asaas**: depois que a Vercel gerar a URL de produção
   (`https://seu-projeto.vercel.app`), configurar o webhook no painel do
   Asaas apontando para `https://seu-projeto.vercel.app/webhooks/asaas`,
   com o mesmo token salvo em `ASAAS_WEBHOOK_TOKEN` na Vercel.
5. Testar o ciclo completo no **sandbox do Asaas** antes de trocar
   `ASAAS_ENV` para `production` com a API key de produção.

**Status confirmado com o usuário**: ela já tem conta no Asaas, no sandbox do
Asaas, no GitHub, no Supabase e na Vercel. O plano é validar tudo no sandbox
primeiro — não é necessário perguntar de novo sobre isso. Só confirmar antes
do passo específico de trocar pra `ASAAS_ENV=production` com API key real.

**Not a decision to make silently**: ir pra produção com `ASAAS_ENV=production`
envolve dinheiro real. Confirmar com o usuário antes desse passo específico,
mesmo que o resto do deploy seja feito sem parar pra perguntar.


## Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (ORM síncrono, não async)
- **Banco**: PostgreSQL 14+, com Row Level Security (RLS) para isolamento
  multi-tenant
- **Auth**: JWT (python-jose) + bcrypt (passlib) para hash de senha
- **Frontend**: ainda não decidido no código — o wireframe é HTML/CSS/JS
  vanilla, mas isso foi só pra prototipar rápido. Recomendo React + Tailwind
  pra implementação real, reaproveitando a paleta e componentes visuais do
  wireframe. Pergunte ao usuário antes de decidir se não estiver claro.
- **Migrations**: ainda não configurado com Alembic — hoje o schema é
  aplicado direto via `psql -f schema_seguranca.sql`

## Comandos

```bash
# ambiente
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# banco (assume Postgres já rodando localmente)
createdb fluxo
psql -U postgres -d fluxo -f schema_seguranca.sql

# rodar a API
uvicorn app.main:app --reload

# rodar o job de faturamento manualmente (normalmente seria cron/scheduler)
python -m app.jobs.faturamento
```

Docs interativas da API: `http://localhost:8000/docs`
Wireframe de referência: abrir `fluxo-app.html` direto no navegador

## Por onde começar (sugestão de ordem)

Se o pedido do usuário for "coloca o app pra funcionar" sem mais detalhe,
essa é uma ordem sensata:

1. Rodar o schema num Postgres local e confirmar que sobe sem erro
2. Subir o backend (`uvicorn`) e confirmar que `/health` responde
3. Testar o fluxo de cadastro + login do profissional via `/docs`
4. A partir daí, perguntar ao usuário: ela quer ver o wireframe virar
   frontend de verdade primeiro, ou completar os endpoints que faltam
   no backend primeiro? Os dois são grandes — não assumir, perguntar.

## Estrutura

```
app/
  core/       -> config.py (variáveis de ambiente + regras de negócio
                 centralizadas), security.py (JWT, hash de senha)
  db/         -> base.py (engine, sessão, Base do SQLAlchemy)
  models/     -> uma classe por tabela do schema.sql (ainda incompleto —
                 só profissional, cliente, assinatura, fatura existem
                 como models Python; o resto só está no SQL)
  schemas/    -> Pydantic (validação de entrada/saída da API)
  api/
    deps.py   -> AQUI mora a ativação do RLS. Toda rota autenticada usa
                 get_db_com_rls, nunca uma sessão "crua"
    routes/   -> um arquivo por recurso (auth, clientes, faturas...)
  jobs/       -> scripts que rodam fora do ciclo request/response (cron)
```

## Regras de negócio que NÃO podem ser quebradas

1. **Cota do plano**: até 4 clientes inclusos, cliente extra (5º+) cobra
   valor fixo adicional por cliente.
2. **Cobrança**: integral por cliente ativo no fim do ciclo, sem pró-rata.
3. **Exclusão de cliente**: `data_limite_exclusao = data_cadastro + 35
   dias`. Cadastrar já cobra o ciclo atual integral — o prazo de 35 dias
   evita a cobrança do **próximo** ciclo, não reembolsa o primeiro.
4. **Inadimplência do profissional**: congela em D+5 (pausa as conexões
   Open Finance dos clientes, pra não gerar custo de conexão), cancela
   definitivo em D+35 a partir do congelamento. Reativação é automática ao
   pagar, com reconexão das contas.
5. **Consentimento Open Finance**: o cliente final autoriza **uma única
   vez** (não a cada acesso). Válido por 12 meses, renovado automaticamente
   enquanto ativo.
6. **Dois planos coexistem sem migração de dado**: `assinaturas.tipo_plano`
   é 'essencial' (upload manual) ou 'completo' (Open Finance).
   `contas_conectadas.modo` reflete isso por conta — upgrade de plano não
   exige migrar histórico.

## Segurança — não pular estas partes

- **RLS é obrigatório em toda rota que toca dado de cliente.** Usar sempre
  `get_db_com_rls` de `app/api/deps.py`. Nunca aceitar `profissional_id` vindo
  do corpo da requisição — sempre derivar do token JWT autenticado.
- **`DATABASE_URL` nunca pode conectar como a role dona das tabelas
  (`postgres` no Supabase)** — essa role tem `BYPASSRLS` e ignora todas as
  policies, mesmo não sendo superuser (verificado na prática: sem isso, um
  profissional via dado de outro). Usar a role restrita `app_fluxo` (sem
  `BYPASSRLS`) em `DATABASE_URL`, e a role dona só em `DATABASE_URL_ADMIN`
  para os poucos casos que legitimamente precisam (ver seção "Deploy na
  web" acima e `app/db/base.py`).
- **Idempotência em cobrança**: toda fatura tem `idempotency_key` única
  (ver `app/jobs/faturamento.py`). Nunca gerar cobrança sem essa chave.
- **Webhook do provedor Open Finance**: validar assinatura HMAC antes de
  processar qualquer payload. Nunca confiar em webhook sem validação.
- **Segredos**: nunca hardcoded, sempre via variável de ambiente (`.env`
  localmente, secret manager em produção). Nunca commitar `.env`.
- **Dedup de transação**: usar o campo `hash_dedup` da tabela `transacoes`
  — o provedor Open Finance reprocessa histórico e pode reenviar a mesma
  transação.

## Convenções de código

- Nomes de tabelas, campos, variáveis de domínio em **português**
  (`clientes`, `data_cadastro`, `valor_honorario_mensal`) — segue o
  vocabulário do negócio, não traduzir para inglês.
- Nomes de classes Python em PascalCase, mas seguindo o mesmo vocabulário
  em português (`Cliente`, `Fatura`, `Assinatura`).
- Toda tabela sensível a multi-tenant tem `profissional_id` mesmo quando
  redundante via join (ex: `transacoes.profissional_id` além de
  `transacoes.cliente_id`) — é proposital, acelera as policies de RLS.
- Navegação do produto é organizada em grupos (Cadastros, Financeiro,
  Relacionamento, Configurações) com dropdown — não criar telas soltas
  no menu principal sem agrupar; ver `fluxo-app.html` para a estrutura
  de referência.

## O que fazer se o usuário pedir "coloca pra funcionar" ou similar

Isso é ambíguo o suficiente pra merecer uma pergunta de esclarecimento antes
de começar (rodar local vs. fazer deploy; completar backend vs. construir
frontend). Mas se for pedido pra "só rodar local e ver funcionando", o
caminho mais rápido e seguro é:
1. Confirmar Postgres instalado (ou subir via Docker se não tiver)
2. Aplicar o schema
3. Subir o backend
4. Abrir o `fluxo-app.html` no navegador pra visualizar o design ao lado
   (ele não fala com o backend ainda — é só referência visual)
5. Reportar claramente pro usuário o que está rodando e o que ainda é
   só maquete, pra não criar a impressão de que o app está "pronto"
   quando na verdade backend e frontend ainda não estão conectados.

