-- Milhas aéreas (parte do Patrimônio)
CREATE TABLE IF NOT EXISTS milhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    categoria TEXT,
    programa TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    proprietario TEXT NOT NULL DEFAULT 'titular',  -- titular | conjuge
    vencimento DATE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_milhas_cliente ON milhas(cliente_id);
-- Classe do ativo no investimento (ex: Ações, CDB, ETF, Título público)
ALTER TABLE investimentos ADD COLUMN IF NOT EXISTS classe_ativo TEXT;
