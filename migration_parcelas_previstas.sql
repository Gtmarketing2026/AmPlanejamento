-- ============================================================================
-- Migration: parcelas futuras previstas.
--
-- Quando uma compra parcelada é importada (ex: "COMPRA NO PARCELADO (5/6)"),
-- o cliente pode optar por já gerar as parcelas futuras (6/6, ...) nos meses
-- seguintes, marcadas como `previsto = true`, pra ter visão dos gastos que
-- ainda vão cair. Quando a fatura real do mês seguinte chega e traz a parcela
-- de verdade, a projeção é substituída (removida antes de inserir a real),
-- então nada duplica -- a reconciliação usa `hash_parcela` (identidade do
-- parcelamento: conta + estabelecimento + total de parcelas + valor + número
-- da parcela), independente da data/formatação exata da descrição.
-- ============================================================================

ALTER TABLE transacoes
    ADD COLUMN IF NOT EXISTS previsto BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hash_parcela TEXT;

CREATE INDEX IF NOT EXISTS idx_transacoes_hash_parcela ON transacoes (conta_conectada_id, hash_parcela);
CREATE INDEX IF NOT EXISTS idx_transacoes_previsto ON transacoes (cliente_id, previsto);
