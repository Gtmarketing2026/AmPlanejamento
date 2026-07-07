-- Meta de gasto (orcamentos_categoria) pode ser restrita a uma subcategoria
-- específica, em vez de sempre a categoria inteira (ex: meta só pra "Uber"
-- dentro de "Transporte"). Opcional -- NULL continua significando "categoria
-- inteira", comportamento de antes.
ALTER TABLE orcamentos_categoria
ADD COLUMN IF NOT EXISTS subcategoria_id UUID REFERENCES subcategorias(id) ON DELETE CASCADE;

-- A constraint antiga (cliente_id, categoria_id, ano, mes) impedia ter uma
-- meta da categoria inteira E uma meta de uma subcategoria específica dela
-- no mesmo mês. Troca por um índice único que trata subcategoria_id NULL
-- como um valor "sentinela" (categoria inteira), permitindo coexistir com
-- metas de subcategorias específicas da mesma categoria.
ALTER TABLE orcamentos_categoria DROP CONSTRAINT IF EXISTS uq_orcamento_categoria_mes;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamento_categoria_sub_mes
ON orcamentos_categoria (cliente_id, categoria_id, COALESCE(subcategoria_id, '00000000-0000-0000-0000-000000000000'::uuid), ano, mes);
