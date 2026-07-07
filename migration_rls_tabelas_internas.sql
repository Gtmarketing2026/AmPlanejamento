-- ============================================================================
-- Segurança: liga RLS nas tabelas internas/administrativas que estavam sem
-- (alerta do Supabase "rls_desativado_em_público"). Sem RLS, elas ficam
-- expostas pela API pública (roles anon/authenticated) do Supabase.
--
-- admins, auditoria_log, despesas_operacionais e webhook_events só são
-- acessadas pelo nível Negócio, que roda na conexão restrita (app_fluxo) com
-- a GUC `app.is_admin = true` (ver app/api/deps.py::get_db_negocio), ou pela
-- conexão privilegiada `postgres` no login (que ignora RLS por ser superuser).
-- Então a policy libera apenas quando `app.is_admin` é true -- mesmo padrão
-- do bypass de admin já usado nas outras policies (schema_seguranca.sql).
-- Requests da API pública não setam essa GUC -> current_setting volta NULL ->
-- acesso negado.
-- ============================================================================

ALTER TABLE admins                ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS so_negocio ON admins;
CREATE POLICY so_negocio ON admins
    USING (current_setting('app.is_admin', true)::boolean IS TRUE)
    WITH CHECK (current_setting('app.is_admin', true)::boolean IS TRUE);

DROP POLICY IF EXISTS so_negocio ON auditoria_log;
CREATE POLICY so_negocio ON auditoria_log
    USING (current_setting('app.is_admin', true)::boolean IS TRUE)
    WITH CHECK (current_setting('app.is_admin', true)::boolean IS TRUE);

DROP POLICY IF EXISTS so_negocio ON despesas_operacionais;
CREATE POLICY so_negocio ON despesas_operacionais
    USING (current_setting('app.is_admin', true)::boolean IS TRUE)
    WITH CHECK (current_setting('app.is_admin', true)::boolean IS TRUE);

DROP POLICY IF EXISTS so_negocio ON webhook_events;
CREATE POLICY so_negocio ON webhook_events
    USING (current_setting('app.is_admin', true)::boolean IS TRUE)
    WITH CHECK (current_setting('app.is_admin', true)::boolean IS TRUE);
