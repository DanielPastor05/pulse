import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import {
  listMessages,
  listPinnedMessages,
  listThread,
} from '@/server/repositories/message.repository';
import { makeConversation, makeUser, prisma, sendMessages, teardown } from './setup.ts';

after(teardown);

test('la paginación recorre el historial sin saltarse ni repetir nada', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const total = 25;
  await sendMessages(
    conversation.id,
    ana.id,
    Array.from({ length: total }, (_, i) => `mensaje ${i}`),
  );

  const vistos: string[] = [];
  let cursor: string | null = null;
  let paginas = 0;

  do {
    const pagina = await listMessages(conversation.id, ana.id, { cursor, limit: 7 });
    vistos.push(...pagina.items.map((item) => item.id));
    cursor = pagina.nextCursor;
    paginas += 1;
    assert.ok(paginas < 20, 'la paginación no termina: hay un ciclo');
  } while (cursor);

  assert.equal(vistos.length, total, 'faltan o sobran mensajes al recorrer las páginas');
  assert.equal(new Set(vistos).size, total, 'alguna página repitió mensajes');
});

test('un cursor sigue siendo estable cuando varios mensajes comparten instante', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);

  // El caso que rompe un cursor ordenado sólo por createdAt: doce mensajes con
  // exactamente la misma marca de tiempo. Sin el desempate por id el orden no
  // es total y la paginación puede saltar o repetir filas.
  const instante = new Date();
  for (let i = 0; i < 12; i += 1) {
    await prisma.message.create({
      data: { conversationId: conversation.id, authorId: ana.id, content: `simultáneo ${i}`, createdAt: instante },
    });
  }

  const vistos: string[] = [];
  let cursor: string | null = null;
  do {
    const pagina = await listMessages(conversation.id, ana.id, { cursor, limit: 5 });
    vistos.push(...pagina.items.map((item) => item.id));
    cursor = pagina.nextCursor;
  } while (cursor);

  assert.equal(vistos.length, 12);
  assert.equal(new Set(vistos).size, 12, 'con el mismo createdAt el cursor repitió filas');
});

test('cada página llega en orden cronológico, de la más antigua a la más nueva', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  await sendMessages(conversation.id, ana.id, ['uno', 'dos', 'tres', 'cuatro']);

  const pagina = await listMessages(conversation.id, ana.id, { limit: 10 });
  const contenidos = pagina.items.map((item) => item.content);

  assert.deepEqual(contenidos, ['uno', 'dos', 'tres', 'cuatro']);
});

test('nextCursor es null cuando ya no queda historial', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  await sendMessages(conversation.id, ana.id, ['solo uno']);

  const pagina = await listMessages(conversation.id, ana.id, { limit: 10 });
  assert.equal(pagina.nextCursor, null);
  assert.equal(pagina.items.length, 1);
});

test('el hilo trae la raíz y sus respuestas, y las respuestas siguen en la conversación', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const conversation = await makeConversation(ana.id, { members: [beto.id] });
  const [raiz] = await sendMessages(conversation.id, ana.id, ['¿quedamos?']);
  assert.ok(raiz);

  for (const texto of ['yo sí', 'y yo']) {
    await prisma.message.create({
      data: { conversationId: conversation.id, authorId: beto.id, content: texto, replyToId: raiz.id },
    });
  }

  const hilo = await listThread(raiz.id, ana.id);
  assert.equal(hilo?.root.id, raiz.id);
  assert.equal(hilo?.replies.length, 2);

  // La decisión de producto documentada: responder no esconde el mensaje del
  // hilo principal. Si esto se rompiera, la gente dejaría de ver respuestas.
  const conversacion = await listMessages(conversation.id, ana.id, { limit: 50 });
  assert.equal(conversacion.items.length, 3);
});

test('listThread devuelve null para un mensaje que ya no existe', async () => {
  const ana = await makeUser('ana');
  const inexistente = '00000000-0000-4000-8000-000000000000';
  assert.equal(await listThread(inexistente, ana.id), null);
});

test('los fijados salen del más reciente al más antiguo y excluyen los borrados', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const [uno, dos, tres] = await sendMessages(conversation.id, ana.id, ['uno', 'dos', 'tres']);
  assert.ok(uno && dos && tres);

  await prisma.message.update({ where: { id: uno.id }, data: { pinnedAt: new Date('2020-01-01') } });
  await prisma.message.update({ where: { id: dos.id }, data: { pinnedAt: new Date('2030-01-01') } });
  await prisma.message.update({
    where: { id: tres.id },
    data: { pinnedAt: new Date('2025-01-01'), deletedAt: new Date() },
  });

  const fijados = await listPinnedMessages(conversation.id, ana.id);
  assert.deepEqual(
    fijados.map((item) => item.content),
    ['dos', 'uno'],
    'el borrado no debe aparecer, y el más reciente va primero',
  );
});

test('el índice único impide dos mensajes con el mismo clientId del mismo autor', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const clientId = 'pending-integration';

  await prisma.message.create({
    data: { conversationId: conversation.id, authorId: ana.id, content: 'primero', clientId },
  });

  // Es la garantía sobre la que se apoya reintentar un envío: sin ella el botón
  // de reintentar publicaría el mensaje dos veces.
  await assert.rejects(
    () =>
      prisma.message.create({
        data: { conversationId: conversation.id, authorId: ana.id, content: 'duplicado', clientId },
      }),
    /unique constraint/i,
  );

  // Y otra persona sí puede usar el mismo clientId: la restricción es por autor.
  const beto = await makeUser('beto');
  await prisma.conversationMember.create({
    data: { conversationId: conversation.id, userId: beto.id, role: 'MEMBER' },
  });
  await prisma.message.create({
    data: { conversationId: conversation.id, authorId: beto.id, content: 'suyo', clientId },
  });
});
