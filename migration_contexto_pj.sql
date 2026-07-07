-- ============================================================================
-- Migration: contexto PF/PJ no lançamento.
--
-- Cliente PF que também tem CNPJ (ver clientes.cnpj) pode separar o que é
-- gasto pessoal do que é da empresa. Cada lançamento tem um contexto
-- ('PF' | 'PJ'); o painel do cliente ganha um seletor Pessoal/Empresa no topo
-- que filtra as visões de lançamento por contexto. Um gasto de empresa pago
-- no pessoal pode ser copiado (fica nos dois) ou movido (só no PJ) pro
-- controle da empresa -- ver POST /clientes/eu/transacoes/{id}/empresa.
-- ============================================================================

ALTER TABLE transacoes
    ADD COLUMN IF NOT EXISTS contexto TEXT NOT NULL DEFAULT 'PF' CHECK (contexto IN ('PF', 'PJ'));

CREATE INDEX IF NOT EXISTS idx_transacoes_contexto ON transacoes (cliente_id, contexto);
