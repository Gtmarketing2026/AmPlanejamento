# Recuperação do sistema (AMplanejador) — runbook

Guia para reerguer o sistema do zero se o computador se perder/quebrar. Mantenha
este arquivo atualizado. **Os valores das senhas/chaves NÃO ficam aqui** — ficam
no gerenciador de senhas (Bitwarden/1Password). Aqui só a lista do que existe e
o passo a passo.

## 1. Onde tudo mora (contas e serviços)

| Serviço | Para quê | Onde acessar |
|---|---|---|
| **GitHub** | Código-fonte (backend + frontend) | github.com/Gtmarketing2026/AmPlanejamento |
| **Vercel** | Deploy do backend e do frontend | vercel.com (projetos: `fluxo-backend`, `fluxo-frontend`) |
| **Supabase** | Banco de dados (PostgreSQL) + Storage (extratos) | supabase.com |
| **OpenAI** | Classificação automática de lançamentos | platform.openai.com |
| **Asaas** | Cobrança/assinatura dos planejadores | asaas.com |
| **Google Cloud** | Vision (OCR de PDF) + Agenda (OAuth do CRM) | console.cloud.google.com |
| **Registrador do domínio** | Domínio do sistema | (registro.br / o registrador usado) |

> Guarde no gerenciador de senhas: login de cada conta + **códigos de recuperação do 2FA** + o cartão de cobrança de Vercel/Supabase.

## 2. Variáveis de ambiente (arquivo `.env`)

O `.env` fica na raiz do backend e **não vai pro GitHub** (está no `.gitignore`).
Guarde uma cópia dele no gerenciador de senhas. Chaves esperadas:

- `DATABASE_URL` e `DATABASE_URL_ADMIN` (Supabase — conexão do app e a privilegiada)
- `JWT_SECRET` (assinatura dos tokens — se mudar, derruba todas as sessões)
- `OPENAI_API_KEY`
- `ASAAS_API_KEY`
- `GOOGLE_VISION_API_KEY` (OCR)
- Credenciais do OAuth Google (CRM/Agenda) e do Supabase Storage

No Vercel, essas mesmas variáveis estão em **Project → Settings → Environment
Variables** (cópia redundante). Se recriar o projeto, precisa recadastrá-las.

## 3. Rodar localmente (num computador novo)

```bash
# 1. Clonar o código
git clone https://github.com/Gtmarketing2026/AmPlanejamento.git
cd AmPlanejamento

# 2. Criar o .env na raiz do backend (copiar do gerenciador de senhas)

# 3. Backend (Python)
python -m venv venv
./venv/Scripts/pip install -e .        # instala do pyproject.toml
./venv/Scripts/python -m uvicorn app.main:app --reload

# 4. Frontend (Node)
cd frontend
npm install
npm run dev
```

## 4. Deploy em produção

Deploy é manual, do local (não auto-deploya pelo git). Rodar em cada pasta:

```bash
# Backend  (na raiz do repo)
vercel --prod --yes
# Frontend
cd frontend && vercel --prod --yes
```

- URLs: backend `fluxo-backend.vercel.app`, frontend `fluxo-frontend-seven.vercel.app`.
- Dependência nova no backend: adicionar no **`pyproject.toml`** (a Vercel instala de lá, não do requirements.txt).

## 5. Banco de dados — backup e restauração

- **Primário:** Supabase Pro → backups diários automáticos + Point-in-Time
  Recovery (restaura por Dashboard → Database → Backups).
- **Redundância própria:** rodar `scripts/backup_banco.sh` periodicamente e
  **guardar o arquivo `.sql.gz` fora do computador** (Google Drive/OneDrive).
- Restaurar um dump próprio:
  ```bash
  gunzip -c backup_AAAA-MM-DD.sql.gz | psql "<DATABASE_URL_ADMIN>"
  ```

## 6. Migrações de banco

Alterações de schema são aplicadas por script (SQL na raiz `migration_*.sql`, ou
via `python` com `create_engine(settings.DATABASE_URL_ADMIN)`). Ao corrigir um
bug de dados, rodar também o recálculo/migração dos dados já existentes.

## 7. Checklist de continuidade (revisar a cada mês)

- [ ] `git push` feito (código do dia no GitHub)
- [ ] Backup do banco recente guardado fora do PC
- [ ] `.env` atualizado no gerenciador de senhas
- [ ] Renovação automática do domínio ligada
- [ ] Cartão de cobrança de Vercel/Supabase válido
- [ ] Códigos de recuperação do 2FA guardados
