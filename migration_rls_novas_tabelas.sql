-- Habilita Row Level Security nas 4 tabelas que foram criadas por CREATE TABLE
-- direto e ficaram SEM RLS (flagadas como CRITICAL pelo Advisor do Supabase):
-- protecao_config, plano_investimento_config, milhas, atualizacoes_sistema.
-- Sem RLS, os roles anon/authenticated (API pública do Supabase) podiam
-- ler/escrever direto, pulando o backend. Mesmo padrão de isolamento das
-- demais tabelas (ver schema_seguranca.sql): app_fluxo respeita RLS,
-- postgres (conexão admin) bypassa.

-- Tabelas com escopo de tenant (têm profissional_id):
ALTER TABLE public.milhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolar_milhas ON public.milhas;
CREATE POLICY isolar_milhas ON public.milhas FOR ALL
  USING ((profissional_id = current_setting('app.current_profissional_id', true)::uuid)
         OR (current_setting('app.is_admin', true)::boolean IS TRUE));

ALTER TABLE public.protecao_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolar_protecao_config ON public.protecao_config;
CREATE POLICY isolar_protecao_config ON public.protecao_config FOR ALL
  USING ((profissional_id = current_setting('app.current_profissional_id', true)::uuid)
         OR (current_setting('app.is_admin', true)::boolean IS TRUE));

ALTER TABLE public.plano_investimento_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolar_plano_investimento_config ON public.plano_investimento_config;
CREATE POLICY isolar_plano_investimento_config ON public.plano_investimento_config FOR ALL
  USING ((profissional_id = current_setting('app.current_profissional_id', true)::uuid)
         OR (current_setting('app.is_admin', true)::boolean IS TRUE));

-- Tabela GLOBAL (changelog, sem profissional_id): só o nível Negócio (is_admin)
-- escreve; a leitura do cliente/planejador passa pela conexão admin que bypassa
-- RLS. anon/authenticated ficam bloqueados (não setam a GUC app.is_admin).
ALTER TABLE public.atualizacoes_sistema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_atualizacoes_sistema ON public.atualizacoes_sistema;
CREATE POLICY admin_atualizacoes_sistema ON public.atualizacoes_sistema FOR ALL
  USING (current_setting('app.is_admin', true)::boolean IS TRUE);
