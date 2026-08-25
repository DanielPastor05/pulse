-- El asistente es una cuenta como las demás, con esta marca encima.
--
-- Una cuenta de verdad y no un caso especial en cada consulta: el hilo, la
-- lista, las notificaciones y los permisos lo tratan como a cualquiera. Lo
-- único que hace falta saber es que no hay una persona detrás.
--
-- `users` y no `User`: el modelo lleva `@@map`. Lo aprendí hace un rato, con la
-- columna del fondo, y me costó un despliegue fallido.
ALTER TABLE "users" ADD COLUMN "isAssistant" BOOLEAN NOT NULL DEFAULT false;
