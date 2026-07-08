-- Admin concede vagas de clientes por planejador (grátis ou com valor custom).
--  - vagas_inclusas: quantas vagas de cliente entram SEM cobrança (padrão 4).
--    Aumentar aqui = conceder vagas gratuitas a um planejador específico.
--  - valor_vaga_extra: valor mensal por cliente acima das inclusas. NULL = usa
--    o padrão do plano. 0 = extras também gratuitos. >0 = preço custom (desconto
--    ou cheio) por vaga excedente.
ALTER TABLE profissionais
  ADD COLUMN IF NOT EXISTS vagas_inclusas   INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS valor_vaga_extra NUMERIC(10,2);
