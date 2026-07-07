-- Fase 1: campos extras no cadastro do planejador (nome da empresa + WhatsApp).
-- Aditivo e nullable -> não quebra registros existentes.
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS nome_empresa TEXT;
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS whatsapp TEXT;
