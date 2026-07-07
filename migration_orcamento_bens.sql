-- ============================================================================
-- Migration: Orçamento por categoria + Bens patrimoniais (Fase 2, parte 2)
--
-- orcamentos_categoria: limite de gasto mensal por categoria (tela
-- "Orçamento" do app do cliente — orçado x realizado).
-- bens_patrimoniais: bens móveis/imóveis cadastrados manualmente, somados ao
-- Patrimônio (o resto do patrimônio já vem de transacoes/investimentos/dividas).
-- ============================================================================

CREATE TABLE IF NOT EXISTS orcamentos_categoria (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    categoria_id         UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    ano                  INT NOT NULL,
    mes                  INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    valor_orcado          NUMERIC(12,2) NOT NULL,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_orcamento_categoria_mes UNIQUE (cliente_id, categoria_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_periodo ON orcamentos_categoria (cliente_id, ano, mes);

ALTER TABLE orcamentos_categoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolar_orcamentos_categoria ON orcamentos_categoria;
CREATE POLICY isolar_orcamentos_categoria ON orcamentos_categoria
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON orcamentos_categoria TO app_fluxo;


CREATE TABLE IF NOT EXISTS bens_patrimoniais (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id           UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id     UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    tipo                 TEXT NOT NULL CHECK (tipo IN ('movel', 'imovel')),
    nome                 TEXT NOT NULL,
    valor                NUMERIC(14,2) NOT NULL,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bens_cliente ON bens_patrimoniais (cliente_id);

ALTER TABLE bens_patrimoniais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolar_bens_patrimoniais ON bens_patrimoniais;
CREATE POLICY isolar_bens_patrimoniais ON bens_patrimoniais
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON bens_patrimoniais TO app_fluxo;
