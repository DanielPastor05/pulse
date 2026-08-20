-- La mitad vectorial de la búsqueda híbrida.
--
-- Escrita a mano y no con `migrate diff`. La generada quiere además borrar
-- `messages_search_idx` y quitarle el DEFAULT a `searchVector`: Prisma no
-- entiende una columna generada ni un índice que sólo existen en SQL, y al no
-- verlos en el esquema los toma por sobrantes. Ya pasó con la auditoría de
-- moderación; aquí va sólo lo nuevo.
--
-- Sin `with schema extensions`, igual que `pg_trgm` en 0_init: el CI corre
-- sobre un Postgres limpio que no tiene ese esquema, y una migración que sólo
-- se aplica en producción no es una migración verificada.
CREATE EXTENSION IF NOT EXISTS vector;

-- 384 dimensiones porque es lo que devuelve `gte-small`, que corre dentro de
-- las Edge Functions de Supabase sin API de terceros ni clave que rotar.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "embedding" vector(384);

-- HNSW y no IVFFlat: IVFFlat necesita datos para entrenar sus listas, y aquí el
-- índice se crea sobre una columna entera a NULL. HNSW se construye de forma
-- incremental, así que sirve desde el primer mensaje.
--
-- Coseno porque los vectores salen normalizados de la función: con norma 1 la
-- distancia coseno y el producto escalar ordenan igual, y es la métrica para la
-- que `gte-small` fue entrenado.
CREATE INDEX IF NOT EXISTS "messages_embedding_idx"
  ON "messages" USING hnsw ("embedding" vector_cosine_ops);

-- Caché de embeddings de consulta.
--
-- Cada búsqueda tiene que embeber lo que se escribió, y eso es un viaje más a
-- la función. Las consultas se repiten muchísimo, así que la caché se lleva la
-- mayor parte de esa latencia añadida.
--
-- La clave es el texto ya normalizado y no el original: «Frankfurt» y
-- « frankfurt » son la misma consulta y deben compartir entrada.
CREATE TABLE IF NOT EXISTS "query_embeddings" (
    "query"     TEXT NOT NULL,
    "embedding" vector(384) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_embeddings_pkey" PRIMARY KEY ("query")
);

-- Para que la limpieza periódica pueda tirar lo que lleva tiempo sin usarse.
CREATE INDEX IF NOT EXISTS "query_embeddings_usedAt_idx"
  ON "query_embeddings"("usedAt");
