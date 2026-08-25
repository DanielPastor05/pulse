-- El fondo del hilo, elegido por cada persona y no por el grupo.
--
-- Va en la membresía y no en la conversación a propósito: es una preferencia de
-- quien mira, como `muted` o `archived`. En la conversación, un miembro podría
-- cambiarle el fondo a los demás.
--
-- Sin valor por defecto: NULL es «sin fondo», que es justo lo que tenían todas
-- las filas hasta ahora. Así la migración no reescribe nada.
ALTER TABLE "ConversationMember" ADD COLUMN "background" TEXT;
