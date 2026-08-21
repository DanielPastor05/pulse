-- El modelo de embeddings pasa de `gte-small` (384) a `bge-m3` (1024).
--
-- Escrita a mano por lo mismo que la de 20260817: `migrate diff` no entiende ni
-- la columna generada ni los índices que sólo existen en SQL, y al no verlos en
-- el esquema los da por sobrantes y los borra.
--
-- El motivo del cambio está medido, no supuesto. `npm run bench:models` compara
-- los dos modelos contra el mismo corpus etiquetado, con 175 distractores de
-- temas vecinos para que el top-5 no sea el 18% del montón:
--
--                dims   total   inglés   español
--   gte-small     384     68%      58%       58%
--   bge-m3       1024     74%      58%       75%
--
-- El inglés no se mueve. Lo que se mueve es el español, que es exactamente lo
-- que debe hacer un modelo multilingüe y la razón por la que se cambia.

-- Los vectores existentes no se convierten: 384 y 1024 dimensiones no son la
-- misma cosa con distinto tamaño, son espacios distintos. `ALTER TYPE` sobre
-- valores no nulos fallaría, y forzarlo con un cast produciría basura que el
-- índice ordenaría igual de contento. La columna se tira y se vuelve a crear;
-- el relleno lo hace el cron, que es el mismo camino del backfill original.
DROP INDEX IF EXISTS "messages_embedding_idx";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "messages" ADD COLUMN "embedding" vector(1024);

-- HNSW otra vez, y por el mismo motivo que la primera vez: IVFFlat necesita
-- datos para entrenar sus listas y aquí la columna vuelve a nacer entera a
-- NULL. El límite de dimensiones del índice HNSW es 2000, así que 1024 entra.
--
-- Coseno porque bge-m3 devuelve vectores normalizados, igual que gte-small.
CREATE INDEX "messages_embedding_idx"
  ON "messages" USING hnsw ("embedding" vector_cosine_ops);

-- La caché de consultas queda entera inservible: son vectores del modelo viejo
-- en el espacio viejo. Vaciarla antes de cambiar el tipo no es limpieza
-- opcional, es lo que permite que `ALTER TYPE` no tenga nada que convertir.
TRUNCATE TABLE "query_embeddings";
ALTER TABLE "query_embeddings" ALTER COLUMN "embedding" TYPE vector(1024);
