import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { publicEnv, serverEnv } from '@/lib/env';
import { describeError, log } from '@/server/logger';

/**
 * Embeddings de mensajes y de consultas.
 *
 * El modelo es `gte-small` corriendo dentro de una Edge Function de Supabase.
 * No hay API de terceros, ni clave que rotar, ni coste por token — que es lo
 * que hace posible indexar cada mensaje en vez de dejar esto en demostración.
 *
 * Los vectores no pasan por Prisma: no sabe leer ni escribir `vector`, así que
 * todo va por SQL crudo con un cast explícito.
 */

/** 384 es lo que devuelve gte-small; se comprueba porque un vector corto rompe el índice. */
const DIMENSIONS = 384;

/**
 * Por debajo de esto el vector es ruido.
 *
 * «ok», «👍» o «jaja» acaban todos en el mismo rincón del espacio, así que
 * embeberlos gasta invocaciones y además mete falsos positivos en la mitad
 * vectorial. Para esos el léxico ya sirve, y es exacto.
 */
export const MIN_EMBED_LENGTH = 15;

/**
 * Cuántos textos van en cada invocación.
 *
 * Medido: con 16 textos de ~120 caracteres la función devuelve 546
 * WORKER_RESOURCE_LIMIT. Se queda en 8 y además se corta por caracteres, porque
 * el coste real va con los tokens y un lote de mensajes largos revienta antes
 * que uno de mensajes cortos.
 */
const BATCH = 8;
const BATCH_CHARS = 3_000;

export function isEmbeddable(content: string): boolean {
  return content.trim().length >= MIN_EMBED_LENGTH;
}

/**
 * Normaliza la consulta antes de usarla como clave de caché.
 *
 * «Frankfurt», « frankfurt » y «frankfurt  » son la misma pregunta y no deberían
 * costar tres invocaciones.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** El formato que entiende el cast a `vector`. */
function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

/** Y el de vuelta: `vector::text` sale como `[0.1,0.2,…]`. */
function parseVectorLiteral(literal: string): number[] | null {
  const parsed = literal
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(Number);
  return parsed.length === DIMENSIONS && parsed.every(Number.isFinite) ? parsed : null;
}

function chunk(texts: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;

  for (const text of texts) {
    if (current.length >= BATCH || (current.length > 0 && chars + text.length > BATCH_CHARS)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Llama a la función. Lanza: quien la use decide si eso importa o no. */
async function callEmbed(texts: string[]): Promise<number[][]> {
  const response = await fetch(`${publicEnv.supabaseUrl}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serverEnv.serviceRoleKey}`,
    },
    body: JSON.stringify({ input: texts }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`embed -> ${response.status} ${(await response.text()).slice(0, 200)}`);
  }

  const body = (await response.json()) as { embeddings?: number[][] };
  const embeddings = body.embeddings ?? [];

  if (embeddings.length !== texts.length) {
    throw new Error(`embed devolvió ${embeddings.length} vectores para ${texts.length} textos`);
  }
  for (const vector of embeddings) {
    if (vector.length !== DIMENSIONS) {
      throw new Error(`embed devolvió ${vector.length} dimensiones, se esperaban ${DIMENSIONS}`);
    }
  }

  return embeddings;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const group of chunk(texts)) {
    out.push(...(await callEmbed(group)));
  }
  return out;
}

/**
 * El vector de una consulta, de la caché o recién calculado.
 *
 * Devuelve el vector y no la clave aunque parezca más caro. Dejarlo en la tabla
 * y leerlo desde la consulta de búsqueda con un subselect tiene dos problemas:
 * si la fila no está —una purga de caché a destiempo— el subselect da NULL, el
 * operador de distancia contra NULL da NULL, y el `ORDER BY` devuelve mensajes
 * **arbitrarios** presentados como coincidencias semánticas. Y además el
 * planificador deja de poder usar el índice HNSW, que necesita un vector
 * constante en la comparación. Cuatro kilobytes de viaje valen las dos cosas.
 *
 * `null` significa «no hay mitad vectorial para esta búsqueda». La búsqueda
 * sigue con la rama léxica sola, que es exactamente lo que hacía antes.
 */
export async function queryEmbedding(rawQuery: string): Promise<number[] | null> {
  const key = normalizeQuery(rawQuery);
  if (key.length < MIN_EMBED_LENGTH) return null;

  const hit = await prisma.$queryRaw<Array<{ embedding: string }>>`
    UPDATE "query_embeddings" SET "usedAt" = now()
     WHERE "query" = ${key}
     RETURNING "embedding"::text AS embedding
  `;
  if (hit[0]) return parseVectorLiteral(hit[0].embedding);

  try {
    const [vector] = await embedTexts([key]);
    if (!vector) return null;

    await prisma.$executeRaw`
      INSERT INTO "query_embeddings" ("query", "embedding")
      VALUES (${key}, ${toVectorLiteral(vector)}::vector)
      ON CONFLICT ("query") DO UPDATE SET "usedAt" = now()
    `;
    return vector;
  } catch (error) {
    // Una búsqueda sin mitad vectorial es peor, no rota. Se registra y se sigue.
    log.warn('embedding.query_failed', describeError(error));
    return null;
  }
}

/**
 * Embebe un mensaje recién escrito.
 *
 * Nunca lanza: corre desprendida de la petición, igual que la tarjeta de
 * enlace, así que un fallo aquí tiene que terminar en silencio y dejar rastro.
 * Lo que quede sin embeber se queda a NULL y lo recoge la tarea programada —
 * que es también el camino del relleno inicial.
 */
export async function embedMessage(messageId: string, content: string): Promise<void> {
  if (!isEmbeddable(content)) return;

  try {
    const [vector] = await embedTexts([content]);
    if (!vector) return;

    await prisma.$executeRaw`
      UPDATE "messages"
         SET "embedding" = ${toVectorLiteral(vector)}::vector
       WHERE "id" = ${messageId}::uuid
    `;
  } catch (error) {
    log.warn('embedding.message_failed', { messageId, ...describeError(error) });
  }
}

/**
 * Rellena los mensajes que se quedaron sin vector.
 *
 * Es a la vez la reparación de los fallos del camino rápido y el relleno de
 * todo lo que ya existía antes de que esto se escribiera: no hay dos códigos
 * distintos porque no son dos problemas distintos.
 *
 * `limit` acota lo que hace una sola ejecución. Con miles de mensajes la tarea
 * avanza un trozo por vuelta en vez de intentarlo todo y agotar el tiempo de la
 * función; que quede trabajo para mañana es correcto y está dicho en el
 * registro.
 */
export async function backfillEmbeddings(limit: number): Promise<{ done: number; left: number }> {
  const pending = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT "id"::text AS id, "content"
      FROM "messages"
     WHERE "embedding" IS NULL
       AND "deletedAt" IS NULL
       AND "kind" = 'TEXT'
       AND length(btrim("content")) >= ${MIN_EMBED_LENGTH}
     ORDER BY "createdAt" DESC
     LIMIT ${limit}
  `;

  // Sin nada pendiente no se llama a la función. Importa más de lo que parece:
  // la tarea corre a diario y lo normal es que no haya nada que hacer.
  if (pending.length === 0) return { done: 0, left: 0 };

  let done = 0;

  for (const group of chunk(pending.map((row) => row.content))) {
    const slice = pending.slice(done, done + group.length);
    try {
      const vectors = await callEmbed(group);
      // Un UPDATE por vector: son pocos por lote y `unnest` con vectores obliga
      // a construir el array en texto, que es más frágil que este bucle.
      await prisma.$transaction(
        vectors.map((vector, index) =>
          prisma.$executeRaw`
            UPDATE "messages"
               SET "embedding" = ${toVectorLiteral(vector)}::vector
             WHERE "id" = ${slice[index]!.id}::uuid
          `,
        ),
      );
      done += group.length;
    } catch (error) {
      // Se corta la vuelta en vez de seguir: si la función está agotada, las
      // siguientes llamadas van a fallar igual y sólo gastan cuota.
      log.warn('embedding.backfill_failed', { done, ...describeError(error) });
      break;
    }
  }

  const remaining = await prisma.$queryRaw<Array<{ left: bigint }>>`
    SELECT count(*) AS left
      FROM "messages"
     WHERE "embedding" IS NULL
       AND "deletedAt" IS NULL
       AND "kind" = 'TEXT'
       AND length(btrim("content")) >= ${MIN_EMBED_LENGTH}
  `;

  return { done, left: Number(remaining[0]?.left ?? 0) };
}

/**
 * Ids de mensajes ordenados por cercanía semántica, para el visor dado.
 *
 * El vector se lee de la caché dentro de la propia consulta. El filtro de
 * pertenencia es el mismo `EXISTS` que usa la rama léxica: la autorización no
 * cambia porque haya una segunda forma de encontrar un mensaje.
 */
export async function vectorMessageIds(
  viewerId: string,
  vector: number[],
  limit: number,
): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT m."id"::text AS id
      FROM "messages" m
     WHERE m."embedding" IS NOT NULL
       AND m."deletedAt" IS NULL
       AND m."kind" = 'TEXT'
       AND EXISTS (
         SELECT 1 FROM "conversation_members" cm
          WHERE cm."conversationId" = m."conversationId" AND cm."userId" = ${viewerId}::uuid
       )
     ORDER BY m."embedding" <=> ${toVectorLiteral(vector)}::vector
     LIMIT ${limit}
  `;

  return rows.map((row) => row.id);
}

export { Prisma };
