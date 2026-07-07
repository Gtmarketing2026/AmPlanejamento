-- Migration: ícone (emoji) por categoria -- usado no novo layout de
-- Lançamentos (ícone + categoria em cima, subcategoria embaixo).
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS icone TEXT;

UPDATE categorias SET icone = '💰' WHERE nome = 'Renda' AND padrao_sistema;
UPDATE categorias SET icone = '🔄' WHERE nome = 'Classificação neutra' AND padrao_sistema;
UPDATE categorias SET icone = '🛍️' WHERE nome = 'Despesas não obrigatórias' AND padrao_sistema;
UPDATE categorias SET icone = '🏠' WHERE nome = 'Despesas obrigatórias' AND padrao_sistema;
UPDATE categorias SET icone = '💳' WHERE nome = 'Dívidas' AND padrao_sistema;
UPDATE categorias SET icone = '💼' WHERE nome = 'Empresa e autônomo' AND padrao_sistema;
UPDATE categorias SET icone = '🏦' WHERE nome = 'Financiamentos' AND padrao_sistema;
UPDATE categorias SET icone = '📈' WHERE nome = 'Investimentos' AND padrao_sistema;
UPDATE categorias SET icone = '🚀' WHERE nome = 'Projetos' AND padrao_sistema;
