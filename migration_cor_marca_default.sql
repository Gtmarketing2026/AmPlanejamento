-- O app do planejador passou a usar a cor de marca como accent. O padrão
-- antigo era azul (#4C8DFF); alinhamos ao accent verde do app (#26D9A8) pra
-- quem nunca personalizou não ter o app mudando de cor sem querer.
-- Só atualiza quem ainda está no azul-padrão antigo (quem escolheu outra cor
-- de propósito — verde/âmbar/vermelho/roxo/rosa/custom — não é tocado).
ALTER TABLE profissionais ALTER COLUMN cor_marca SET DEFAULT '#26D9A8';
UPDATE profissionais SET cor_marca = '#26D9A8' WHERE cor_marca = '#4C8DFF';
