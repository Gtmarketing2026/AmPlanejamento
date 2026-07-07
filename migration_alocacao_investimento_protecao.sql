-- ============================================================================
-- Migration: alocação investimento->meta, meta mensal de investimento por
-- objetivo, e módulo Minha Proteção (seguros). Aditivo.
-- ============================================================================

-- Um investimento pode ter seu valor dividido entre vários objetivos
-- (metas) -- ex: metade de um CDB pra reserva de emergência, metade pra
-- independência financeira.
CREATE TABLE IF NOT EXISTS investimento_alocacoes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investimento_id      UUID NOT NULL REFERENCES investimentos(id) ON DELETE CASCADE,
    meta_id              UUID NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    valor_alocado         NUMERIC(14,2) NOT NULL,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_alocacao_investimento_meta UNIQUE (investimento_id, meta_id)
);

CREATE INDEX IF NOT EXISTS idx_alocacoes_investimento ON investimento_alocacoes (investimento_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_meta ON investimento_alocacoes (meta_id);

ALTER TABLE investimento_alocacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolar_investimento_alocacoes ON investimento_alocacoes;
CREATE POLICY isolar_investimento_alocacoes ON investimento_alocacoes
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON investimento_alocacoes TO app_fluxo;


-- Meta de investimento mensal por objetivo (usada no resumo de Investimentos
-- e na tela "Distribuir meta de investimentos").
ALTER TABLE metas ADD COLUMN IF NOT EXISTS aporte_mensal_meta NUMERIC(12,2);

-- Carteira detalhada: instituição (texto livre, sem tabela de lookup) e
-- liquidez (ex: "Diária", "D+30", "Sem vencimento").
ALTER TABLE investimentos ADD COLUMN IF NOT EXISTS instituicao_nome TEXT;
ALTER TABLE investimentos ADD COLUMN IF NOT EXISTS liquidez TEXT;


-- Minha Proteção: apólices de seguro cadastradas manualmente pelo cliente.
CREATE TABLE IF NOT EXISTS apolices_seguro (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    tipo                 TEXT NOT NULL CHECK (tipo IN ('vida', 'saude', 'patrimonial', 'outro')),
    seguradora           TEXT NOT NULL,
    valor_cobertura       NUMERIC(14,2) NOT NULL,
    premio_mensal         NUMERIC(12,2),
    vencimento           DATE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apolices_cliente ON apolices_seguro (cliente_id);

ALTER TABLE apolices_seguro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolar_apolices_seguro ON apolices_seguro;
CREATE POLICY isolar_apolices_seguro ON apolices_seguro
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON apolices_seguro TO app_fluxo;
