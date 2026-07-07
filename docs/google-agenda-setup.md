# Configurar o Google Agenda no Fluxo (registro OAuth)

Isso é feito **uma vez só** por você (dona do produto). Depois disso, cada
planejador conecta a própria conta Google pelo botão "Conectar Google" no CRM.

## Passo 1 — Criar/escolher o projeto

1. Acesse https://console.cloud.google.com
2. No topo, clique no seletor de projeto → **Novo projeto**
   - Nome: `Fluxo` (ou o que preferir)
3. Aguarde criar e selecione esse projeto.

## Passo 2 — Ativar a Google Calendar API

1. Menu (☰) → **APIs e serviços** → **Biblioteca**
2. Busque **Google Calendar API** → clique → **Ativar**

## Passo 3 — Tela de consentimento OAuth

1. Menu → **APIs e serviços** → **Tela de permissão OAuth**
2. Tipo de usuário: **Externo** → Criar
3. Preencha:
   - Nome do app: `Fluxo`
   - E-mail de suporte: seu e-mail
   - Domínios autorizados: `vercel.app` (e o domínio próprio, se usar)
   - E-mail de contato do desenvolvedor: seu e-mail
4. **Escopos** → Adicionar ou remover escopos → marque/adicione:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/calendar.events`  ← permite criar/excluir eventos
   - Salvar
5. **Usuários de teste** → adicione o e-mail Google de cada planejador que vai
   testar agora (pode ir adicionando depois). Até 100 usuários no modo teste.
6. Salvar.

## Passo 4 — Criar a credencial (Client ID)

1. Menu → **APIs e serviços** → **Credenciais**
2. **Criar credenciais** → **ID do cliente OAuth**
3. Tipo de aplicativo: **Aplicativo da Web**
4. Nome: `Fluxo backend`
5. **URIs de redirecionamento autorizados** → Adicionar URI → cole **exatamente**:
   ```
   https://fluxo-backend.vercel.app/crm/google/callback
   ```
   (sem barra no final, sem espaços)
6. Criar.
7. Aparece o **Client ID** e o **Client secret** — copie os dois.

## Passo 5 — Me mandar as chaves

Me envie:
- **Client ID** (algo como `123456-abcd.apps.googleusercontent.com`)
- **Client secret** (algo como `GOCSPX-...`)

Eu configuro as 3 variáveis no servidor (Vercel do `fluxo-backend`):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI = https://fluxo-backend.vercel.app/crm/google/callback`

A partir daí o botão **"Conectar Google"** aparece no CRM de cada planejador, e
cada um conecta a própria agenda.

---

## Importante: modo Teste x Produção

- Enquanto o app estiver em **"Testes"**, só os e-mails na lista de *usuários de
  teste* conseguem conectar, e o Google **expira o refresh token a cada 7 dias**
  (o planejador teria que reconectar toda semana). Bom pra validar.
- Pra liberar pra **qualquer planejador** e ter conexão estável (refresh token
  não expira), é preciso mudar o app para **"Em produção"** na tela de
  consentimento. Como o escopo `calendar.events` é *sensível*, o Google pede uma
  **verificação** do app (formulário + revisão; pode levar alguns dias). Não é
  obrigatório pra começar — dá pra rodar em modo teste primeiro e verificar
  depois, quando o volume justificar.
