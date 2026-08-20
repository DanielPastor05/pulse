import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { SEARCH_PAGE_SIZE } from '@/lib/constants';
import { messageInclude, publicUserSelect, toMessage, toPublicUser } from '@/server/repositories/selectors';
import { getSummariesFor } from '@/server/repositories/conversation.repository';
import { queryEmbedding, vectorMessageIds } from '@/server/services/embedding.service';
import { fuse } from '@/server/services/rrf';
import type { SearchResults } from '@/types/dto';

export type SearchScope = 'all' | 'users' | 'conversations' | 'messages' | 'files';

const EMPTY: SearchResults = {
  users: [],
  conversations: [],
  messages: [],
  files: [],
  nextCursor: null,
};

/**
 * Restricts a search to conversations the viewer belongs to.
 *
 * Expressed as a relation filter — Prisma compiles it to a correlated `EXISTS`
 * — rather than by loading the viewer's conversation ids and passing them as an
 * `IN` list. Both are correct; only this one has a bounded query size. Somebody
 * in five hundred groups would otherwise put five hundred UUIDs into the text
 * of every search they run.
 */
const memberOf = (viewerId: string) => ({
  conversation: { members: { some: { userId: viewerId } } },
});

/**
 * Below this, full text search has nothing to offer.
 *
 * `to_tsquery` matches whole lexemes; with one or two letters there is no
 * lexeme to match and prefix search would return most of the table. Trigram
 * still finds those inside words, so short queries keep the old path and the
 * `gin_trgm_ops` index that already serves it.
 */
const MIN_FULL_TEXT_LENGTH = 3;

/**
 * Cuántos candidatos trae cada rama antes de fusionar.
 *
 * RRF ordena por **posición dentro de lo recuperado**, así que estos números
 * son el horizonte real de la búsqueda: un mensaje que no entre aquí no existe
 * para la fusión, por muchas páginas que se pidan. Está dicho en «Known limits»
 * en vez de dejar que parezca exhaustivo.
 *
 * Las dos profundidades son distintas a propósito, y la asimetría está medida.
 * Todo lo que devuelve la rama léxica **casa de verdad** —`@@` es un filtro
 * duro—, así que ir hondo no cuesta precisión. La vectorial no tiene filtro
 * alguno: devuelve los N más cercanos por lejos que estén, y con `gte-small`
 * sobre textos cortos no hay distancia que separe una consulta con sentido de
 * una sin sentido. Medido sobre este corpus: el mejor candidato de «qwerty
 * asdfgh zxcvbn» queda a 0,178 y el de «the thing about the server being slow»
 * a 0,191 — el galimatías **más cerca** que la consulta buena. Cualquier umbral
 * que rechace uno rechaza el otro.
 *
 * Como no hay umbral honesto, se limita el daño por el otro lado: la rama
 * vectorial aporta pocos candidatos. Los aciertos de paráfrasis aparecen en los
 * primeros puestos —es lo que se mide en el banco de calidad—, así que recortar
 * la cola quita ruido sin quitar recall.
 */
const LEXICAL_DEPTH = 200;
const VECTOR_DEPTH = 25;

/**
 * A `tsquery` built from the user's words, with every term as a prefix.
 *
 * The prefix is what keeps search usable while typing: without `:*`, «quasa»
 * finds nothing until the last letter of «quasar» lands. Terms are rebuilt from
 * letters and digits only, so none of the operators `tsquery` understands —
 * `&`, `|`, `!`, `(`, `:` — can arrive from the outside and change its meaning.
 */
function toPrefixQuery(query: string): string | null {
  const terms = query.split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  if (terms.length === 0) return null;
  return terms.map((term) => `${term}:*`).join(' & ');
}

type RankedRow = { id: string; rank: number };

/**
 * Message ids ordered by how well they match, newest first among equals.
 *
 * The cursor carries the rank as well as the id because rank is the primary
 * sort: paging on the id alone would walk a different order than the one on
 * screen. `(rank, id)` is total, which is the same reason the conversation
 * history had to break `createdAt` ties by id.
 */
async function lexicalMessageIds(
  viewerId: string,
  tsquery: string,
  limit: number,
): Promise<string[]> {
  const query = Prisma.sql`to_tsquery('simple', ${tsquery})`;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT m."id"::text AS id
    FROM "messages" m
    WHERE m."searchVector" @@ ${query}
      AND m."deletedAt" IS NULL
      AND m."kind" = 'TEXT'
      AND EXISTS (
        SELECT 1 FROM "conversation_members" cm
        WHERE cm."conversationId" = m."conversationId" AND cm."userId" = ${viewerId}::uuid
      )
    ORDER BY ts_rank(m."searchVector", ${query}) DESC, m."id" DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => row.id);
}

/**
 * Las dos ramas, fusionadas.
 *
 * La léxica encuentra lo que se cita; la vectorial, lo que se describe. Los
 * mensajes de chat son cortos, y ahí ninguna de las dos basta sola: el vector
 * falla con nombres propios, códigos e identificadores, y el léxico falla con
 * cualquier paráfrasis. Por eso se conservan las dos en vez de sustituir una
 * por otra, que es lo habitual.
 *
 * Se fusiona en Node y no en SQL a propósito. RRF sólo necesita posiciones, así
 * que traer 200 ids por rama y sumarlos aquí deja la fusión como una función
 * pura que se puede probar con listas fijas, sin motor y sin modelo. Las dos
 * consultas van en paralelo, así que el viaje de más no se paga en latencia.
 *
 * El cursor se aplica después de fusionar. La fusión es determinista para la
 * misma consulta —las dos ramas devuelven lo mismo y en el mismo orden—, así
 * que la página siguiente camina exactamente la lista que se vio en pantalla.
 */
async function fusedMessageIds(
  viewerId: string,
  tsquery: string | null,
  queryVector: number[] | null,
  limit: number,
  cursor: { rank: number; id: string } | null,
): Promise<RankedRow[]> {
  const [lexical, vector] = await Promise.all([
    tsquery ? lexicalMessageIds(viewerId, tsquery, LEXICAL_DEPTH) : Promise.resolve([]),
    queryVector ? vectorMessageIds(viewerId, queryVector, VECTOR_DEPTH) : Promise.resolve([]),
  ]);

  const fused = fuse([lexical, vector]);

  // Mismo orden total que antes: `(puntuación, id)` descendente. La comparación
  // va en flotante de doble precisión y no en `real` porque las puntuaciones
  // RRF son diminutas —del orden de 0,016— y `real` no distingue dos posiciones
  // consecutivas a esa escala.
  const after = cursor
    ? fused.filter(
        (row) => row.rank < cursor.rank || (row.rank === cursor.rank && row.id < cursor.id),
      )
    : fused;

  return after.slice(0, limit);
}

/** `rank:id`, opaque to the client and cheap to parse back. */
export function encodeSearchCursor(row: RankedRow): string {
  return `${row.rank}:${row.id}`;
}

function decodeSearchCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  const separator = cursor.indexOf(':');
  if (separator < 0) return null;
  const rank = Number(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  return Number.isFinite(rank) && id ? { rank, id } : null;
}

/**
 * One query, four result sets. Everything is scoped to conversations the
 * viewer is actually a member of, so search can never leak private history.
 */
export async function globalSearch(
  viewerId: string,
  rawQuery: string,
  scope: SearchScope = 'all',
  cursor?: string | null,
): Promise<SearchResults> {
  const query = rawQuery.trim();
  if (query.length < 2) return EMPTY;

  const wants = (target: SearchScope) => scope === 'all' || scope === target;

  // Por encima de tres caracteres manda la relevancia; por debajo, el trigrama,
  // que es lo único que encuentra algo dentro de una palabra a esa longitud.
  const tsquery = query.length >= MIN_FULL_TEXT_LENGTH ? toPrefixQuery(query) : null;

  // Deja la consulta embebida en la caché y devuelve su clave, o `null` si no
  // hay mitad vectorial para esta búsqueda —consulta demasiado corta, o la
  // función de embeddings caída—. En ese caso la búsqueda sigue exactamente
  // como antes de todo esto, con la rama léxica sola.
  const queryVector = tsquery && wants('messages') ? await queryEmbedding(query) : null;

  const ranked =
    tsquery || queryVector
      ? await fusedMessageIds(
          viewerId,
          tsquery,
          queryVector,
          SEARCH_PAGE_SIZE,
          decodeSearchCursor(cursor),
        )
      : null;

  const [users, memberships, messages, attachments] = await Promise.all([
    wants('users')
      ? prisma.user.findMany({
          where: {
            id: { not: viewerId },
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { displayName: { contains: query, mode: 'insensitive' } },
            ],
            blocksMade: { none: { blockedId: viewerId } },
            blocksReceived: { none: { blockerId: viewerId } },
          },
          select: publicUserSelect,
          take: SEARCH_PAGE_SIZE,
          orderBy: { username: 'asc' },
        })
      : Promise.resolve([]),

    wants('conversations')
      ? prisma.conversationMember.findMany({
          where: {
            userId: viewerId,
            conversation: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { members: { some: { user: { displayName: { contains: query, mode: 'insensitive' } } } } },
              ],
            },
          },
          select: { conversationId: true },
          take: SEARCH_PAGE_SIZE,
        })
      : Promise.resolve([]),

    // Con relevancia: la consulta de arriba ya decidió el orden, así que aquí
    // sólo se hidratan esos ids. Sin ella (consultas cortas): trigrama, por
    // recencia, como antes.
    !wants('messages')
      ? Promise.resolve([])
      : ranked
        ? ranked.length === 0
          ? Promise.resolve([])
          : prisma.message.findMany({
              where: { id: { in: ranked.map((row) => row.id) } },
              include: {
                ...messageInclude(viewerId),
                conversation: { select: { id: true, name: true, type: true, avatarUrl: true } },
              },
            })
        : prisma.message.findMany({
            where: {
              ...memberOf(viewerId),
              deletedAt: null,
              kind: 'TEXT',
              content: { contains: query, mode: 'insensitive' },
            },
            include: {
              ...messageInclude(viewerId),
              conversation: { select: { id: true, name: true, type: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: SEARCH_PAGE_SIZE,
          }),

    wants('files')
      ? prisma.attachment.findMany({
          where: {
            name: { contains: query, mode: 'insensitive' },
            message: { ...memberOf(viewerId), deletedAt: null },
          },
          include: {
            message: {
              select: {
                id: true,
                createdAt: true,
                conversationId: true,
                conversation: { select: { name: true, type: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: SEARCH_PAGE_SIZE,
        })
      : Promise.resolve([]),
  ]);

  const conversations = await getSummariesFor(
    memberships.map((membership) => membership.conversationId),
    viewerId,
  );

  // `findMany` con `in` no promete orden, y el que importa lo fijó el ranking.
  const ordered = ranked
    ? ranked
        .map((row) => messages.find((message) => message.id === row.id))
        .filter((message): message is (typeof messages)[number] => message !== undefined)
    : messages;

  return {
    users: users.map(toPublicUser),
    conversations,
    // Sólo hay más páginas cuando la página vino llena: una a medias ya agotó
    // los resultados, y ofrecer «cargar más» para no traer nada es peor que no
    // ofrecerlo.
    nextCursor:
      ranked && ranked.length === SEARCH_PAGE_SIZE && ranked.at(-1)
        ? encodeSearchCursor(ranked[ranked.length - 1]!)
        : null,
    messages: ordered.map((row) => ({
      message: toMessage(row, viewerId),
      conversation: {
        id: row.conversation.id,
        name: row.conversation.name ?? 'Direct message',
        type: row.conversation.type,
        avatarUrl: row.conversation.avatarUrl,
      },
    })),
    files: attachments.map((attachment) => ({
      attachment: {
        id: attachment.id,
        kind: attachment.kind,
        url: attachment.url,
        path: attachment.path,
        name: attachment.name,
        size: attachment.size,
        mimeType: attachment.mimeType,
        width: attachment.width,
        height: attachment.height,
        duration: attachment.duration,
        waveform: attachment.waveform,
      },
      messageId: attachment.message.id,
      conversationId: attachment.message.conversationId,
      conversationName: attachment.message.conversation.name ?? 'Direct message',
      createdAt: attachment.message.createdAt.toISOString(),
    })),
  };
}
