-- Impressão digital do arquivo importado (sha256 do conteúdo). Serve pra
-- detectar a MESMA fatura sendo importada de novo e bloquear a duplicação --
-- imune à variação do OCR (dedup por transação não funciona com OCR).
ALTER TABLE importacoes_extrato ADD COLUMN IF NOT EXISTS arquivo_hash TEXT;
CREATE INDEX IF NOT EXISTS ix_importacoes_cliente_hash
  ON importacoes_extrato (cliente_id, arquivo_hash);
