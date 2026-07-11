-- Data inicial do projeto (aba Projetos, antiga Metas)
ALTER TABLE metas ADD COLUMN IF NOT EXISTS data_inicial DATE;
-- Cônjuge do cliente (cadastro simples: nome). Usado pra separar contas/rendas.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS conjuge_nome TEXT;
-- Marca uma conta/cartão como sendo do cônjuge (default: do titular).
ALTER TABLE contas_conectadas ADD COLUMN IF NOT EXISTS de_conjuge BOOLEAN NOT NULL DEFAULT false;
-- tipo do projeto agora aceita valores personalizados (texto livre) -- remove
-- o CHECK que travava num conjunto fixo.
ALTER TABLE metas DROP CONSTRAINT IF EXISTS metas_tipo_check;
