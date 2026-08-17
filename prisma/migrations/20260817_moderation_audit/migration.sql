-- Registro de acciones de moderación.
--
-- Escrita a mano y no con `migrate diff` tal cual. La generada quería además
-- borrar `messages_search_idx` y quitarle el DEFAULT a `searchVector`: Prisma
-- no entiende una columna generada ni un índice GIN que sólo existen en SQL, y
-- al no verlos en el esquema los toma por sobrantes. Aplicarla habría dejado la
-- búsqueda sin índice en silencio.
--
-- Aquí va sólo lo nuevo.

CREATE TYPE "ModerationAction" AS ENUM (
  'MEMBER_REMOVED', 'ROLE_CHANGED', 'MESSAGE_DELETED', 'REPORT_REVIEWED'
);

CREATE TABLE "moderation_events" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "actorId" UUID,
    "actorName" TEXT NOT NULL,
    "targetId" UUID,
    "targetName" TEXT,
    "action" "ModerationAction" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "moderation_events_conversationId_createdAt_idx"
  ON "moderation_events"("conversationId", "createdAt" DESC);

ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Actor y objetivo son SetNull, como el autor de un mensaje: el historial
-- sobrevive a la cuenta de quien actuó. Por eso el nombre va copiado en texto.
ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "moderation_events" ADD CONSTRAINT "moderation_events_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sólo se añade. Sin política de UPDATE ni de DELETE, así que RLS las deniega
-- por defecto: un registro que el moderador puede reescribir no sirve para lo
-- único que sirve un registro.
ALTER TABLE "moderation_events" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderators read their conversation audit" ON "moderation_events";
CREATE POLICY "moderators read their conversation audit"
  ON "moderation_events" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "conversation_members" cm
      WHERE cm."conversationId" = "moderation_events"."conversationId"
        AND cm."userId" = auth.uid()
        AND cm."role" IN ('OWNER', 'ADMIN', 'MODERATOR')
    )
  );
