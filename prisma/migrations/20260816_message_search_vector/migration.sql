-- Búsqueda por relevancia sobre el contenido de los mensajes.
--
-- Columna generada y no mantenida por trigger: una columna que se calcula sola
-- no puede quedar desincronizada, y no hay un camino de escritura que se pueda
-- olvidar de actualizarla.
--
-- Configuración `simple` a propósito, ni `spanish` ni `english`. El contenido
-- mezcla los dos idiomas y elegir uno estropea el otro: `english` reduce
-- «running» a «run» pero deja «corriendo» intacto, y al revés. `simple` no
-- lematiza, así que trata ambos igual — peor recuperación en cada idioma por
-- separado, coherente en una conversación real.
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce("content", ''))) STORED;

CREATE INDEX IF NOT EXISTS "messages_search_idx"
  ON "messages" USING GIN ("searchVector");
