-- Separa conta/cartão por Pessoal (PF) e Empresa (PJ), como já acontece com os
-- lançamentos. Default 'ambos' pra não sumir nada do histórico: contas antigas
-- continuam aparecendo nas duas visões até serem marcadas.

ALTER TABLE contas_conectadas
  ADD COLUMN IF NOT EXISTS contexto TEXT NOT NULL DEFAULT 'ambos';

ALTER TABLE contas_conectadas DROP CONSTRAINT IF EXISTS contas_conectadas_contexto_check;
ALTER TABLE contas_conectadas ADD CONSTRAINT contas_conectadas_contexto_check
  CHECK (contexto IN ('PF', 'PJ', 'ambos'));
