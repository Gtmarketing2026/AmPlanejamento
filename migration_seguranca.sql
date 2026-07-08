-- Segurança: rate limiting de login (anti-força-bruta) + MFA/2FA do admin.

-- 1) Contador de tentativas de login por conta (força bruta). Preenchido pela
--    conexão privilegiada (dona da tabela) durante o login, antes de qualquer
--    autenticação -- por isso RLS ligado sem policy permissiva (só o owner toca).
CREATE TABLE IF NOT EXISTS bloqueios_login (
    chave          TEXT PRIMARY KEY,           -- "<tipo>:<identificador>"
    tentativas     INTEGER NOT NULL DEFAULT 0,
    janela_inicio  TIMESTAMPTZ NOT NULL DEFAULT now(),
    bloqueado_ate  TIMESTAMPTZ
);
ALTER TABLE bloqueios_login ENABLE ROW LEVEL SECURITY;
-- Policy só pro nível Negócio (app.is_admin); o login usa a conexão dona
-- (bypassa RLS), então isso é só pra satisfazer o "RLS em toda tabela pública".
DROP POLICY IF EXISTS so_negocio_bloqueios ON bloqueios_login;
CREATE POLICY so_negocio_bloqueios ON bloqueios_login
    USING (current_setting('app.is_admin', true)::boolean IS TRUE);

-- 2) MFA/2FA do admin (TOTP). Aditivo, sem default de segredo.
ALTER TABLE admins
    ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
    ADD COLUMN IF NOT EXISTS mfa_ativo  BOOLEAN NOT NULL DEFAULT FALSE;
