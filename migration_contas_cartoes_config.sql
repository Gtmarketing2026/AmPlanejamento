-- ============================================================================
-- Migration: Minhas Contas (contas + cartões nomeados), preferências do
-- cliente (visualização competência x virada de cartão) e mês de referência
-- por lançamento.
--
-- Reaproveita `contas_conectadas` pra representar tanto conta bancária
-- quanto cartão de crédito (mesmo conceito: uma fonte financeira nomeada,
-- só que com campos diferentes preenchidos conforme `natureza`) em vez de
-- criar uma tabela paralela quase idêntica.
-- ============================================================================

ALTER TABLE contas_conectadas
    ADD COLUMN IF NOT EXISTS natureza TEXT NOT NULL DEFAULT 'conta' CHECK (natureza IN ('conta', 'cartao')),
    ADD COLUMN IF NOT EXISTS nome_exibicao TEXT,
    ADD COLUMN IF NOT EXISTS saldo_manual NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS limite_total NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS dia_virada INTEGER CHECK (dia_virada IS NULL OR (dia_virada BETWEEN 1 AND 31)),
    ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Mês de referência do lançamento (1º dia do mês) -- por padrão é o mês
-- calendário da própria data; quando a preferência do cliente é "virada do
-- cartão" e o cartão tem dia_virada configurado, passa a ser o mês seguinte
-- pra compras feitas depois da virada. Calculado e gravado na hora da
-- importação/criação (ver app/api/routes/importacoes.py e clientes.py),
-- não em tempo de leitura -- mais simples de consultar depois.
ALTER TABLE transacoes
    ADD COLUMN IF NOT EXISTS mes_referencia DATE;

CREATE INDEX IF NOT EXISTS idx_transacoes_mes_referencia ON transacoes (cliente_id, mes_referencia);

-- ----------------------------------------------------------------------------
-- Preferências do cliente final (uma linha por cliente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preferencias_cliente (
    cliente_id              UUID PRIMARY KEY REFERENCES clientes(id) ON DELETE CASCADE,
    profissional_id         UUID NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
    visualizacao_lancamento TEXT NOT NULL DEFAULT 'data_compra' CHECK (visualizacao_lancamento IN ('data_compra', 'virada_cartao')),
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE preferencias_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS isolar_preferencias_cliente ON preferencias_cliente;
CREATE POLICY isolar_preferencias_cliente ON preferencias_cliente
    USING (profissional_id = current_setting('app.current_profissional_id', true)::UUID
           OR current_setting('app.is_admin', true)::boolean IS TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON preferencias_cliente TO app_fluxo;
