-- Vínculo lançamento -> dívida cadastrada: uma parcela lançada pode abater de
-- uma dívida (aba Dívidas). ON DELETE SET NULL: apagar a dívida só desfaz o
-- vínculo, não apaga o lançamento. O abatimento em si é feito na aplicação
-- (mexe em dividas.valor_pago / parcelas_pagas; valor_restante é gerado).

ALTER TABLE transacoes
  ADD COLUMN IF NOT EXISTS divida_id UUID REFERENCES dividas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_transacoes_divida_id ON transacoes(divida_id);
