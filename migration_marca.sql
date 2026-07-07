-- Fase 1: vídeo de boas-vindas na marca do planejador (aditivo).
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS video_boas_vindas TEXT;
