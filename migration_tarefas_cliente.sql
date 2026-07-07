-- ============================================================================
-- Migration: tarefas_cliente (checklist de tarefas que o profissional passa
-- pro cliente fazer — ex: "investir R$X na ação Y", "reduzir gasto com
-- restaurante", "abrir reclamação no Bacen").
--
-- O profissional cria/edita/exclui (via /crm). O cliente só enxerga e marca
-- como concluída (via /clientes/eu/tarefas). Mesmo padrão multi-tenant das
-- demais tabelas (RLS pelo profissional_id; acesso do cliente passa pela
-- conexão privilegiada com filtro explícito por cliente_id do token).
-- ============================================================================

CREATE TABLE IF NOT EXISTS tarefas_cliente (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    titulo          TEXT NOT NULL,
    descricao       TEXT,
    prazo           DATE,
    concluido       BOOLEAN NOT NULL DEFAULT FALSE,
    concluido_em    TIMESTAMPTZ,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_cliente_id ON tarefas_cliente(cliente_id);

ALTER TABLE tarefas_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolar_tarefas_cliente ON tarefas_cliente;
CREATE POLICY isolar_tarefas_cliente ON tarefas_cliente
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON tarefas_cliente TO app_fluxo;
