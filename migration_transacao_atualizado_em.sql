-- Rastreia quando um lançamento foi editado pela última vez (não só criado).
-- Necessário pra "reuso do histórico do cliente" saber qual classificação é a
-- mais RECENTE (uma correção manual de hoje deve vencer um auto-classificado
-- de meses atrás, mesmo que o auto-classificado tenha sido IMPORTADO depois).
ALTER TABLE transacoes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();
