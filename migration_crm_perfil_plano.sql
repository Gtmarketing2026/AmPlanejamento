-- ============================================================================
-- CRM: histórico + situação atual do cliente e Plano de Ação (roadmap).
--  - clientes.historico: texto livre com o histórico/contexto do cliente.
--  - clientes.situacao_atual: "onde estou" (ponto de partida do mapa;
--    objetivo_principal já existe e é o "onde quero chegar").
--  - plano_etapas: passos do plano de ação com horizonte de tempo e status,
--    renderizados como um caminho visível (onde estou -> etapas -> objetivo).
-- Mesmo padrão multi-tenant das demais tabelas do CRM (RLS por profissional).
-- ============================================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS historico TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS situacao_atual TEXT;

CREATE TABLE IF NOT EXISTS plano_etapas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    ordem           INT NOT NULL DEFAULT 0,
    titulo          TEXT NOT NULL,
    descricao       TEXT,
    horizonte       TEXT,  -- mapeamento de tempo, ex: "Próximos 3 meses", "1 ano"
    status          TEXT NOT NULL DEFAULT 'a_fazer',  -- a_fazer | em_andamento | concluida
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plano_etapas_cliente_id ON plano_etapas(cliente_id);

ALTER TABLE plano_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolar_plano_etapas ON plano_etapas;
CREATE POLICY isolar_plano_etapas ON plano_etapas
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON plano_etapas TO app_fluxo;
