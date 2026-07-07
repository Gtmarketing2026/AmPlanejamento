-- ============================================================================
-- Migration: Meu Futuro (aposentadoria) + Metas por prioridade (essencial/
-- desejo/sonho -- curto/médio/longo prazo). Aditivo, nullable/com default,
-- não quebra linhas existentes.
-- ============================================================================

ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS idade_atual INT;
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS idade_aposentadoria INT;
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS renda_desejada_mensal NUMERIC(12,2);
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS outras_rendas_mensal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS taxa_pos_aposentadoria_pct NUMERIC(6,3);
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS aporte_necessario NUMERIC(12,2);
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS patrimonio_necessario NUMERIC(14,2);

ALTER TABLE metas ADD COLUMN IF NOT EXISTS prioridade TEXT NOT NULL DEFAULT 'desejo'
    CHECK (prioridade IN ('essencial', 'desejo', 'sonho'));
-- essencial = curto prazo · desejo = médio prazo · sonho = longo prazo
