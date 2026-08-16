-- «Un voto por encuesta» pasa de ser una regla del servicio a una restricción.
--
-- El servicio leía y luego escribía dentro de una transacción, lo que no basta
-- en read committed: dos toques simultáneos en opciones distintas de una
-- encuesta de respuesta única se intercalaban —ambos borraban, ambos
-- insertaban— y dejaban dos votos donde sólo cabe uno.
--
-- La columna sólo se rellena cuando la encuesta admite una respuesta. Postgres
-- considera distintos dos NULL en un índice único, así que las encuestas de
-- opción múltiple siguen pudiendo acumular votos sin que la restricción las
-- toque.
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "singleChoicePollId" uuid;

-- Rellena lo que ya existe, para que la restricción se pueda crear sobre datos
-- históricos. Si alguna encuesta de respuesta única ya tuviera votos duplicados
-- por la carrera, el índice fallaría aquí — y es preferible enterarse al migrar
-- que seguir acumulándolos en silencio.
UPDATE "poll_votes" v
SET "singleChoicePollId" = o."pollId"
FROM "poll_options" o
JOIN "polls" p ON p."id" = o."pollId"
WHERE v."optionId" = o."id"
  AND p."multiple" = false
  AND v."singleChoicePollId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "poll_votes_userId_singleChoicePollId_key"
  ON "poll_votes" ("userId", "singleChoicePollId");
