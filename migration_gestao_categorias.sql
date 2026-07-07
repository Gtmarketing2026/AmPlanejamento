-- Gestão de categorias: cliente pode ter categorias/subcategorias próprias
-- (só dele, não afeta outros clientes do mesmo planejador), além das
-- padrão do sistema e das compartilhadas pelo planejador (já existiam).
-- contexto ('PF'|'PJ'|'ambos') deixa PF e PJ funcionarem como espelhos --
-- tudo que um tem, o outro pode ter, mas separado (default 'ambos' preserva
-- o comportamento atual pras categorias já existentes).
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE;
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS contexto VARCHAR NOT NULL DEFAULT 'ambos';

ALTER TABLE subcategorias ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE;
