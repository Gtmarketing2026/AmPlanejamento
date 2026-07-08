-- Critérios editáveis da saúde financeira do cliente, por planejador.
-- Aditivo: defaults = as regras que estavam hardcoded no _classificar_saude.
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS saude_reserva_min_meses  NUMERIC(5,1) NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS saude_verde_reserva_meses NUMERIC(5,1) NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS saude_verde_poupanca_pct  NUMERIC(5,1) NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS saude_azul_reserva_meses  NUMERIC(5,1) NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS saude_azul_poupanca_pct   NUMERIC(5,1) NOT NULL DEFAULT 30;
