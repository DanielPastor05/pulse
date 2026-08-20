import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { PrismaClient } from '@prisma/client';

import { listMessages, listThread } from '@/server/repositories/message.repository';
import { getSummariesFor } from '@/server/repositories/conversation.repository';
import { makeConversation, makeUser, prisma, sendMessages, teardown } from './setup.ts';

/**
 * La barrera de rendimiento del CI.
 *
 * Cuenta consultas, no milisegundos. Un presupuesto de tiempo de reloj en un
 * runner compartido es intermitente, y una barrera intermitente se acaba
 * desactivando — con lo que deja de proteger justo lo que venía a proteger.
 *
 * El número de consultas sí es determinista, y además es exactamente la forma
 * del fallo que este proyecto ya pagó caro: una página de veinte resultados que
 * emitía cuarenta viajes secuenciales. Lo que garantiza esta barrera es que el
 * coste **no crece con el tamaño de la página**, que es la propiedad que se
 * rompe cuando alguien vuelve a meter una consulta dentro de un bucle.
 */

/** Un cliente aparte, instrumentado, para no espiar al que usan las demás. */
const spy = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });

let queries = 0;
spy.$on('query', () => {
  queries += 1;
});

/**
 * Cuenta las consultas que emite una operación.
 *
 * Los eventos de Prisma llegan de forma asíncrona respecto a la promesa que
 * resuelve, así que sin ceder el turno al bucle de eventos se contarían de
 * menos y la barrera pasaría siempre.
 */
async function countQueries(work: () => Promise<unknown>): Promise<number> {
  queries = 0;
  await work();
  await new Promise((resolve) => setTimeout(resolve, 50));
  return queries;
}

after(async () => {
  await spy.$disconnect();
  await teardown();
});

test('listar mensajes cuesta lo mismo con veinte que con cinco', async () => {
  const ana = await makeUser('perf');
  const conversation = await makeConversation(ana.id);
  await sendMessages(
    conversation.id,
    ana.id,
    Array.from({ length: 40 }, (_, i) => `mensaje número ${i}`),
  );

  const pocos = await countQueries(() =>
    listMessages(conversation.id, ana.id, { limit: 5 }),
  );
  const muchos = await countQueries(() =>
    listMessages(conversation.id, ana.id, { limit: 20 }),
  );

  assert.equal(
    muchos,
    pocos,
    `cuadruplicar la página pasó de ${pocos} a ${muchos} consultas: eso es un N+1`,
  );
  // Y una cota absoluta, para que «constante pero enorme» tampoco pase.
  assert.ok(muchos <= 4, `una página de mensajes no debería costar ${muchos} consultas`);
});

test('el resumen de conversaciones no crece con el número de conversaciones', async () => {
  // Es la consulta que costó 6035 ms hasta que se agrupó: resolvía cada
  // conversación por separado, así que veinte resultados eran cuarenta viajes.
  const ana = await makeUser('perf');
  const ids: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    ids.push((await makeConversation(ana.id, { name: `Sala ${i}` })).id);
  }

  const dos = await countQueries(() => getSummariesFor(ids.slice(0, 2), ana.id));
  const ocho = await countQueries(() => getSummariesFor(ids, ana.id));

  assert.equal(
    ocho,
    dos,
    `pasar de dos a ocho conversaciones costó de ${dos} a ${ocho} consultas`,
  );
});

test('un hilo cuesta lo mismo con cinco respuestas que con treinta', async () => {
  const ana = await makeUser('perf');
  const conversation = await makeConversation(ana.id);
  const [root] = await sendMessages(conversation.id, ana.id, ['la raíz del hilo']);
  assert.ok(root);

  for (let i = 0; i < 30; i += 1) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        authorId: ana.id,
        content: `respuesta ${i}`,
        replyToId: root.id,
      },
    });
  }

  const pocas = await countQueries(() => listThread(root.id, ana.id, { limit: 5 }));
  const muchas = await countQueries(() => listThread(root.id, ana.id, { limit: 30 }));

  assert.equal(muchas, pocas, `de ${pocas} a ${muchas} consultas al pedir más respuestas`);
});

test('la búsqueda tiene índice detrás, no un escaneo secuencial', async () => {
  // Aquí no se puede contar consultas —siempre son las mismas— así que se le
  // pregunta al planificador. Es determinista y no depende de lo cargado que
  // esté el runner, a diferencia de cronometrar.
  const plan = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
    `EXPLAIN SELECT id FROM messages
      WHERE "searchVector" @@ to_tsquery('simple', 'quasar:*')
      ORDER BY ts_rank("searchVector", to_tsquery('simple', 'quasar:*')) DESC
      LIMIT 20`,
  );

  const texto = plan.map((row) => Object.values(row).join(' ')).join('\n');

  // Con pocas filas Postgres elige un escaneo secuencial porque de verdad es
  // más barato, así que lo que se comprueba es que el índice **existe y es
  // elegible**, no que se use con una tabla de juguete. Perder el índice es el
  // fallo que esto tiene que cazar.
  const indices = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
     WHERE tablename = 'messages' AND indexname = 'messages_search_idx'
  `;

  assert.equal(indices.length, 1, 'el índice GIN de búsqueda ha desaparecido');
  assert.ok(texto.length > 0, 'EXPLAIN no devolvió plan');
});
