import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { errors } from '@/server/errors';
import { requireMembership } from '@/server/repositories/conversation.repository';
import { sendMessage } from '@/server/services/message.service';
import { describeError, log } from '@/server/logger';
import type { ScheduledMessageDTO } from '@/types/dto';

/**
 * Cuántos mensajes puede tener alguien esperando en una conversación.
 *
 * No es una limitación técnica sino un tope de cordura: sin él, una cuenta
 * puede dejar cargada una avalancha para dentro de un año y no hay manera de
 * pararla desde el otro lado. Veinticinco es más de lo que nadie programa y
 * poco menos de lo que sirve para molestar.
 */
const MAX_PENDIENTES = 25;

/** Un año. Más allá, lo que se está programando es un despiste. */
const MAX_ADELANTO_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Cuántas filas coge cada despacho, y a los cuántos minutos se vuelve a poder
 * coger una que se quedó reclamada sin terminar.
 */
const POR_TANDA = 10;
const RECLAMO_CADUCA_MIN = 5;

/**
 * Cada cuánto mira una instancia si hay algo que enviar.
 *
 * El despacho va colgado de `after()` en todas las peticiones, así que sin esto
 * habría una consulta por petición para preguntar algo que casi siempre es que
 * no. Y no se frena con la tabla de reclamos que usan los presupuestos: ese
 * freno cuesta el mismo viaje a la base que la consulta que quiere evitar. Una
 * marca en memoria no cuesta ninguno.
 *
 * Que cada instancia lleve su propia cuenta no importa: el reclamo de las filas
 * es atómico, así que dos instancias mirando a la vez no pueden coger lo mismo.
 * Lo único que cambia es que se mire más a menudo, que es inofensivo.
 */
const MIRAR_CADA_MS = 20_000;
let ultimoVistazo = 0;

const seleccion = {
  id: true,
  conversationId: true,
  content: true,
  replyToId: true,
  scheduledFor: true,
  createdAt: true,
} as const;

function toDTO(fila: {
  id: string;
  conversationId: string;
  content: string;
  replyToId: string | null;
  scheduledFor: Date;
  createdAt: Date;
}): ScheduledMessageDTO {
  return {
    id: fila.id,
    conversationId: fila.conversationId,
    content: fila.content,
    replyToId: fila.replyToId,
    scheduledFor: fila.scheduledFor.toISOString(),
    createdAt: fila.createdAt.toISOString(),
  };
}

/**
 * Programar un mensaje.
 *
 * Aquí se comprueba la pertenencia, pero **no** el bloqueo: eso se mira al
 * enviar. Entre programar y enviar puede pasar cualquier cosa —que te bloqueen,
 * que te echen del grupo, que borren la conversación— y lo que decide si el
 * mensaje sale es el estado de ese momento, no el de cuando se escribió. Es la
 * diferencia entre programar un envío y comprar un derecho a enviar.
 */
export async function programarMensaje(
  conversationId: string,
  author: User,
  input: { content: string; scheduledFor: string; replyToId?: string | null },
): Promise<ScheduledMessageDTO> {
  await requireMembership(conversationId, author.id);

  const content = input.content.trim();
  if (!content) throw errors.badRequest('Write something to schedule.');

  const cuando = new Date(input.scheduledFor);
  if (Number.isNaN(cuando.getTime())) throw errors.badRequest('That is not a valid date.');

  const ahora = Date.now();
  if (cuando.getTime() <= ahora) throw errors.badRequest('Pick a time in the future.');
  if (cuando.getTime() - ahora > MAX_ADELANTO_MS) {
    throw errors.badRequest('That is more than a year away.');
  }

  if (input.replyToId) {
    const padre = await prisma.message.findFirst({
      where: { id: input.replyToId, conversationId },
      select: { id: true },
    });
    if (!padre) throw errors.badRequest('You can only reply to messages in this conversation.');
  }

  const pendientes = await prisma.scheduledMessage.count({
    where: { conversationId, authorId: author.id, sentMessageId: null, failedReason: null },
  });
  if (pendientes >= MAX_PENDIENTES) {
    throw errors.badRequest('You already have too many scheduled messages here.');
  }

  const fila = await prisma.scheduledMessage.create({
    data: {
      conversationId,
      authorId: author.id,
      content,
      replyToId: input.replyToId ?? null,
      scheduledFor: cuando,
    },
    select: seleccion,
  });

  return toDTO(fila);
}

/** Lo que a esta persona le queda por salir en esta conversación. */
export async function listarProgramados(
  conversationId: string,
  userId: string,
): Promise<ScheduledMessageDTO[]> {
  await requireMembership(conversationId, userId);

  const filas = await prisma.scheduledMessage.findMany({
    where: { conversationId, authorId: userId, sentMessageId: null, failedReason: null },
    orderBy: { scheduledFor: 'asc' },
    select: seleccion,
  });

  return filas.map(toDTO);
}

/**
 * Cancelar uno.
 *
 * El `authorId` va en el `where` del borrado y no en una comprobación previa:
 * así no hay hueco entre mirar quién es el dueño y borrar. Si no es tuyo, el
 * borrado no encuentra nada, que es la misma respuesta que si no existiera —y
 * es la respuesta correcta, porque tampoco debes poder distinguir esos dos
 * casos.
 */
export async function cancelarProgramado(id: string, userId: string): Promise<void> {
  const { count } = await prisma.scheduledMessage.deleteMany({
    where: { id, authorId: userId, sentMessageId: null },
  });
  if (count === 0) throw errors.notFound('That scheduled message no longer exists.');
}

/**
 * Enviar lo que ya toca.
 *
 * **Va montado sobre el tráfico y no sobre un temporizador**, igual que la
 * revisión de presupuestos. En este plan las tareas programadas corren como
 * mucho una vez al día, así que un cron entregaría un mensaje de las tres de la
 * tarde a saber cuándo. Con el tráfico, la entrega ocurre en la primera
 * petición posterior a la hora.
 *
 * Lo que eso significa, dicho sin adornos: **si nadie usa la aplicación, el
 * mensaje espera**. Con gente dentro el retraso es de milisegundos; a las cinco
 * de la mañana puede ser de horas. Es una propiedad del despliegue, no un
 * fallo, y por eso la interfaz dice «se enviará a partir de» y no «a las».
 *
 * El reclamo es una sola sentencia: `UPDATE … WHERE id IN (SELECT … FOR UPDATE
 * SKIP LOCKED) RETURNING`. Dos peticiones simultáneas no pueden coger la misma
 * fila, y la que llega segunda no se queda esperando a la primera: se lleva las
 * siguientes.
 *
 * Un reclamo caducado se vuelve a coger a los cinco minutos, por si quien lo
 * cogió murió a mitad. Ese reintento **no puede duplicar el mensaje**: el envío
 * va con `clientId`, y sobre `(authorId, clientId)` hay una restricción única
 * que ya existía para que reintentar un envío desde el móvil no publicara dos
 * veces. La misma garantía sirve aquí sin escribir nada nuevo.
 *
 * Nunca lanza: corre desprendida de una petición que ya se respondió.
 */
export async function despacharProgramados(): Promise<number> {
  try {
    const ahora = Date.now();
    if (ahora - ultimoVistazo < MIRAR_CADA_MS) return 0;
    ultimoVistazo = ahora;

    const filas = await prisma.$queryRaw<
      Array<{ id: string; conversationId: string; authorId: string; content: string; replyToId: string | null }>
    >`
      UPDATE "scheduled_messages" SET "claimedAt" = now()
       WHERE "id" IN (
         SELECT "id" FROM "scheduled_messages"
          WHERE "sentMessageId" IS NULL
            AND "failedReason" IS NULL
            AND "scheduledFor" <= now()
            AND ("claimedAt" IS NULL
                 OR "claimedAt" < now() - make_interval(mins => ${RECLAMO_CADUCA_MIN}::int))
          ORDER BY "scheduledFor"
          LIMIT ${POR_TANDA}
            FOR UPDATE SKIP LOCKED
       )
      RETURNING "id", "conversationId", "authorId", "content", "replyToId"
    `;

    if (filas.length === 0) return 0;

    let enviados = 0;
    for (const fila of filas) {
      try {
        const autor = await prisma.user.findUnique({ where: { id: fila.authorId } });
        if (!autor) throw new Error('el autor ya no existe');

        const mensaje = await sendMessage(fila.conversationId, autor, {
          content: fila.content,
          replyToId: fila.replyToId,
          attachments: [],
          // La idempotencia de la que depende el reintento. Determinista a
          // partir del identificador de la fila, no aleatoria.
          clientId: `sched:${fila.id}`,
        });

        await prisma.scheduledMessage.update({
          where: { id: fila.id },
          data: { sentMessageId: mensaje.id },
        });
        enviados += 1;
      } catch (error) {
        // Guardar el motivo y no reintentar. Casi todos los fallos aquí son
        // permanentes —te bloquearon, te fuiste del grupo, borraron el mensaje
        // al que respondía— y reintentar un envío que nunca va a salir sólo
        // consigue que se intente para siempre en cada petición.
        const motivo = describeError(error).error;
        await prisma.scheduledMessage.update({
          where: { id: fila.id },
          data: { failedReason: motivo.slice(0, 300) },
        });
        log.warn('scheduled.failed', { id: fila.id, motivo });
      }
    }

    if (enviados > 0) log.info('scheduled.dispatched', { enviados, cogidos: filas.length });
    return enviados;
  } catch (error) {
    log.error('scheduled.dispatch_failed', describeError(error));
    return 0;
  }
}
