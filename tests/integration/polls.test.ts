import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { makeConversation, makeUser, prisma, teardown } from './setup.ts';

after(teardown);

/** Una encuesta con sus opciones, colgada de un mensaje real. */
async function makePoll(
  conversationId: string,
  authorId: string,
  { multiple = false, options = ['A', 'B', 'C'] } = {},
) {
  const message = await prisma.message.create({
    data: { conversationId, authorId, content: '', kind: 'POLL' },
  });
  const poll = await prisma.poll.create({
    data: {
      messageId: message.id,
      question: '¿Dónde comemos?',
      multiple,
      options: { create: options.map((label, position) => ({ label, position })) },
    },
    include: { options: { orderBy: { position: 'asc' } } },
  });
  return poll;
}

const votosDe = (userId: string, pollId: string) =>
  prisma.pollVote.count({ where: { userId, option: { pollId } } });

test('la base de datos impide dos votos en una encuesta de respuesta única', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const poll = await makePoll(conversation.id, ana.id);
  const [a, b] = poll.options;
  assert.ok(a && b);

  await prisma.pollVote.create({
    data: { optionId: a.id, userId: ana.id, singleChoicePollId: poll.id },
  });

  // Esta es la garantía: ya no depende de que el servicio se acuerde.
  await assert.rejects(
    () =>
      prisma.pollVote.create({
        data: { optionId: b.id, userId: ana.id, singleChoicePollId: poll.id },
      }),
    /unique constraint/i,
    'la restricción debería rechazar el segundo voto',
  );
});

test('una encuesta de opción múltiple sí acumula votos', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const poll = await makePoll(conversation.id, ana.id, { multiple: true });
  const [a, b, c] = poll.options;
  assert.ok(a && b && c);

  // `singleChoicePollId` queda null, y Postgres no considera iguales dos null,
  // así que la misma restricción no estorba aquí.
  for (const option of [a, b, c]) {
    await prisma.pollVote.create({ data: { optionId: option.id, userId: ana.id } });
  }

  assert.equal(await votosDe(ana.id, poll.id), 3);
});

test('la restricción es por persona, no global', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const conversation = await makeConversation(ana.id, { members: [beto.id] });
  const poll = await makePoll(conversation.id, ana.id);
  const [a] = poll.options;
  assert.ok(a);

  await prisma.pollVote.create({
    data: { optionId: a.id, userId: ana.id, singleChoicePollId: poll.id },
  });
  await prisma.pollVote.create({
    data: { optionId: a.id, userId: beto.id, singleChoicePollId: poll.id },
  });

  assert.equal(await votosDe(ana.id, poll.id), 1);
  assert.equal(await votosDe(beto.id, poll.id), 1);
});

test('votar la misma opción dos veces sigue siendo imposible', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const poll = await makePoll(conversation.id, ana.id, { multiple: true });
  const [a] = poll.options;
  assert.ok(a);

  await prisma.pollVote.create({ data: { optionId: a.id, userId: ana.id } });

  // Este único ya existía y sigue haciendo falta: en las múltiples es lo único
  // que impide que un doble clic cuente dos veces la misma respuesta.
  await assert.rejects(
    () => prisma.pollVote.create({ data: { optionId: a.id, userId: ana.id } }),
    /unique constraint/i,
  );
});

test('dos votos simultáneos en opciones distintas dejan exactamente uno', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const poll = await makePoll(conversation.id, ana.id);
  const [a, b] = poll.options;
  assert.ok(a && b);

  // La carrera de verdad, tal y como la provoca un doble toque en móvil: ambas
  // transacciones leen el mismo estado, ambas borran y ambas insertan. Antes
  // esto dejaba dos votos; ahora una de las dos choca con la restricción.
  const votar = (optionId: string) =>
    prisma
      .$transaction(async (tx) => {
        await tx.pollVote.deleteMany({
          where: { userId: ana.id, option: { pollId: poll.id } },
        });
        await tx.pollVote.create({
          data: { optionId, userId: ana.id, singleChoicePollId: poll.id },
        });
      })
      .then(
        () => 'ok' as const,
        () => 'rechazado' as const,
      );

  const resultados = await Promise.all([votar(a.id), votar(b.id)]);

  assert.equal(
    await votosDe(ana.id, poll.id),
    1,
    'la invariante es que quede uno, gane quien gane',
  );
  assert.ok(
    resultados.includes('ok'),
    'alguna de las dos debe entrar; si fallan las dos, el voto está roto',
  );
});
