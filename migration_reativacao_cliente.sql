-- Recadastro/reativação de cliente excluído.
-- Problema: `clientes_nickname_key` (UNIQUE total em nickname) fazia um cliente
-- EXCLUÍDO segurar o nickname refém, bloqueando o recadastro do mesmo CPF (o
-- nickname padrão é o próprio CPF) e o reuso do nickname por outro planejador.
-- Solução: unicidade PARCIAL — só entre clientes NÃO excluídos.

ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_nickname_key;
DROP INDEX IF EXISTS clientes_nickname_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_nickname_ativo
    ON clientes (nickname)
    WHERE nickname IS NOT NULL AND status <> 'excluido';
