-- Investimento como tipo próprio de categoria (nem despesa, nem neutra).
-- Aplicar dinheiro é alocação de patrimônio, não despesa de consumo: some na aba
-- Investimentos, não no fluxo de saídas. Ver categorias.tipo.

-- 1) Permitir 'investimento' no CHECK de categorias.tipo.
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_tipo_check;
ALTER TABLE categorias ADD CONSTRAINT categorias_tipo_check
  CHECK (tipo IN ('entrada', 'saida', 'neutra', 'investimento'));

-- 2) A categoria "Investimentos" (hoje tipo='saida') passa a ser 'investimento'.
UPDATE categorias
   SET tipo = 'investimento'
 WHERE lower(nome) = 'investimentos'
   AND tipo = 'saida';
