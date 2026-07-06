-- ============================================================================
-- Migration: credenciais_google (OAuth do Google Agenda por profissional)
--
-- As tabelas interacoes_crm e follow_ups já existem (schema_seguranca.sql).
-- Esta migration só adiciona o armazenamento das credenciais OAuth e a
-- policy de RLS correspondente, seguindo o mesmo padrão multi-tenant.
-- ============================================================================

CREATE TABLE IF NOT EXISTS credenciais_google (
    profissional_id          UUID PRIMARY KEY REFERENCES profissionais(id) ON DELETE CASCADE,
    email_google              TEXT,
    refresh_token             TEXT NOT NULL,
    access_token              TEXT,
    access_token_expira_em    TIMESTAMPTZ,
    calendar_id               TEXT NOT NULL DEFAULT 'primary',
    criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credenciais_google ENABLE ROW LEVEL SECURITY;

-- Mesma policy multi-tenant das demais tabelas: o profissional só enxerga a
-- própria linha; o nível Negócio (app.is_admin) enxerga todas.
DROP POLICY IF EXISTS isolar_credenciais_google ON credenciais_google;
CREATE POLICY isolar_credenciais_google ON credenciais_google
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

-- A role de aplicação (app_fluxo) precisa de acesso DML à nova tabela.
GRANT SELECT, INSERT, UPDATE, DELETE ON credenciais_google TO app_fluxo;
