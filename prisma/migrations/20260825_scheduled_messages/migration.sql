-- Mensajes escritos ahora para que salgan más tarde.
--
-- Tabla aparte y no un `messages` con fecha futura: un mensaje sin enviar en la
-- tabla de mensajes se cuela en el recuento de sin leer, en la vista previa de
-- la lista, en la búsqueda y en el hilo. Cada consulta tendría que aprender a
-- excluirlo y la que se olvidara lo enseñaría antes de tiempo.
--
-- El DDL lo generó Prisma (`migrate diff --from-empty`), no está escrito a mano,
-- para que no haya deriva entre el esquema y lo que hay en la base.
CREATE TABLE "scheduled_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "replyToId" UUID,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "sentMessageId" UUID,
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- El índice que usa el despachador: buscar lo que ya toca enviar.
CREATE INDEX "scheduled_messages_scheduledFor_idx" ON "scheduled_messages"("scheduledFor");

-- Y el que usa la lista de «lo que tengo pendiente en esta conversación».
CREATE INDEX "scheduled_messages_authorId_conversationId_idx" ON "scheduled_messages"("authorId", "conversationId");

-- En cascada los dos: si se borra la conversación o la cuenta, lo programado no
-- tiene dónde salir. Es la misma clase de basura que dejó huérfanas las
-- conversaciones de un usuario borrado y llenó el 95% de la base sin que se
-- notara.
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS sin política: deniega todo por la superficie que Supabase publica sobre
-- esta misma base. La aplicación entra por Prisma, que no pasa por ahí.
--
-- Va en la migración y no sólo en `sql/security.sql` a propósito: la migración
-- corre sola en cada despliegue, y el fichero de seguridad hay que acordarse de
-- ejecutarlo. Una tabla nueva sin RLS es exactamente el descuido que nadie ve.
ALTER TABLE "scheduled_messages" ENABLE ROW LEVEL SECURITY;
