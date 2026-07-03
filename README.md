# Fluxo — Backend (MVP)

Stack: **Python + FastAPI + SQLAlchemy + Postgres**, seguindo o schema já
validado em `schema_seguranca.sql` (RLS multi-tenant, idempotência de
cobrança, dedup de transação, auditoria, taxonomia de categorias/tags).

> **Usando Claude Code?** Leia `CLAUDE.md` primeiro — ele já tem todo o
> contexto do projeto, as regras de negócio que não podem ser quebradas, e
> por onde começar. Claude Code lê esse arquivo automaticamente ao abrir a
> pasta.

## Deploy em produção (GitHub + Supabase + Vercel + Asaas)

Caminho recomendado pra colocar o app no ar:

1. Push do código pro GitHub
2. Criar projeto no [Supabase](https://supabase.com) → rodar
   `schema_seguranca.sql` inteiro no SQL Editor do painel → copiar a
   connection string de **Connection Pooling** (porta 6543)
3. Importar o repositório na [Vercel](https://vercel.com) → configurar as
   variáveis de ambiente (`.env.example` como referência) → deploy
4. Configurar o webhook no [Asaas](https://asaas.com) apontando pra
   `https://SEU-PROJETO.vercel.app/webhooks/asaas`
5. Testar tudo no sandbox do Asaas antes de virar `ASAAS_ENV=production`

Detalhes completos de cada etapa estão no `CLAUDE.md`.

## Setup rápido com Docker (rodar só localmente, sem depender do Supabase)

```bash
docker run --name fluxo-db -e POSTGRES_PASSWORD=fluxo -e POSTGRES_DB=fluxo -p 5432:5432 -d postgres:16
psql postgresql://postgres:fluxo@localhost:5432/fluxo -f schema_seguranca.sql
```

Depois, no `.env`, use: `DATABASE_URL=postgresql://postgres:fluxo@localhost:5432/fluxo`

## Por que essa stack

- **Python**: você já usa pandas nos relatórios — curva de aprendizado menor
  pra manter o backend depois.
- **FastAPI**: gera documentação automática (`/docs`), validação de dados
  nativa via Pydantic, e é rápido de escrever endpoint novo.
- **Postgres com Row Level Security**: o isolamento entre profissionais
  (tenants) é garantido pelo próprio banco, não só pelo código da aplicação —
  já implementado no schema.

## Setup local (com Postgres já instalado)

```bash
# 1. Criar ambiente virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Configurar variáveis de ambiente
cp .env.example .env
# editar .env com os valores reais (banco local, JWT secret, etc.)

# 4. Rodar o schema no Postgres
psql -U seu_usuario -d fluxo -f schema_seguranca.sql

# 5. Subir a API
uvicorn app.main:app --reload
```

A documentação interativa fica em `http://localhost:8000/docs`.

## Estrutura

```
app/
  core/       -> configuração e segurança (JWT, hash de senha)
  db/         -> engine e sessão do SQLAlchemy
  models/     -> tabelas mapeadas (espelham o schema.sql)
  schemas/    -> validação de entrada/saída (Pydantic)
  api/
    deps.py   -> dependências de rota — AQUI mora a ativação do RLS
    routes/   -> endpoints agrupados por recurso
  jobs/
    faturamento.py -> job de cobrança do ciclo, idempotente
```

## O ponto mais importante: `api/deps.py`

Toda rota que acessa dado de cliente usa `get_db_com_rls`, que seta
`app.current_profissional_id` na transação antes de qualquer query. Isso é o
que faz as policies de RLS do banco funcionarem — sem essa dependência, uma
query mal escrita não vaza dado entre profissionais porque o Postgres
simplesmente não devolve nada (fail-closed), mas o comportamento correto só
existe se essa dependência for usada de forma consistente.

**Nunca** crie uma rota nova que acesse `clientes`, `transacoes`, `faturas`
etc. usando `get_db_sem_rls`. Essa dependência existe só para cadastro/login,
onde ainda não há profissional autenticado.

## Próximos passos técnicos (não incluídos neste MVP inicial)

- [ ] Alembic configurado para migrations versionadas (hoje o schema é
      aplicado direto via `psql`)
- [ ] Integração real com o provedor Open Finance (usar o script
      `testar_pluggy.py` como referência dos campos retornados)
- [ ] Endpoint de webhook com validação de assinatura HMAC
- [ ] Integração com gateway de pagamento (idempotency key já está pronta
      no schema e no job de faturamento, falta plugar a chamada real)
- [ ] Scheduler para rodar `jobs/faturamento.py` e o job de congelamento/
      cancelamento por inadimplência diariamente
- [ ] Testes automatizados, principalmente o teste de isolamento
      multi-tenant (tentar acessar cliente de outro profissional)
