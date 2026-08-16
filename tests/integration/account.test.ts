import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { exportAccount, orphanedGroups } from '@/server/services/account.service';
import { makeConversation, makeUser, prisma, sendMessages, teardown } from './setup.ts';

after(teardown);

test('un grupo con más gente dentro impide borrar la cuenta de su dueño', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const grupo = await makeConversation(ana.id, { members: [beto.id], name: 'Equipo' });

  const bloquean = await orphanedGroups(ana.id);
  assert.equal(bloquean.length, 1);
  assert.equal(bloquean[0]?.id, grupo.id);
  assert.equal(bloquean[0]?.memberCount, 2);

  // A Beto no le bloquea nada: no es dueño de nada.
  assert.deepEqual(await orphanedGroups(beto.id), []);
});

test('un grupo donde ya no queda nadie más no bloquea nada', async () => {
  const ana = await makeUser('ana');
  const sola = await makeConversation(ana.id, { name: 'Sólo yo' });

  // Se va con la cuenta y no deja a nadie atrapado, así que no hay motivo para
  // pedir que lo transfiera: no hay a quién.
  assert.deepEqual(await orphanedGroups(ana.id), []);
  assert.ok(sola.id);
});

test('un chat directo no cuenta como grupo huérfano', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  await prisma.conversation.create({
    data: {
      type: 'DIRECT',
      ownerId: ana.id,
      members: {
        create: [
          { userId: ana.id, role: 'MEMBER' },
          { userId: beto.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Un directo sin dueño no deja a nadie sin administrador: no hay nada que
  // administrar. Pedir transferirlo sería fricción sin motivo.
  assert.deepEqual(await orphanedGroups(ana.id), []);
});

test('la exportación trae lo tuyo y deja fuera lo de los demás', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const conversation = await makeConversation(ana.id, { members: [beto.id] });

  await sendMessages(conversation.id, ana.id, ['mío uno', 'mío dos']);
  await sendMessages(conversation.id, beto.id, ['suyo, y no debe salir']);

  const [mensaje] = await sendMessages(conversation.id, ana.id, ['con reacción']);
  assert.ok(mensaje);
  await prisma.reaction.create({
    data: { messageId: mensaje.id, userId: ana.id, emoji: '👍' },
  });
  await prisma.starredMessage.create({ data: { messageId: mensaje.id, userId: ana.id } });

  const exportado = await exportAccount(ana);

  const contenidos = exportado.messages.map((m) => m.content);
  assert.deepEqual(contenidos, ['mío uno', 'mío dos', 'con reacción']);
  assert.equal(
    contenidos.includes('suyo, y no debe salir'),
    false,
    'los mensajes de otra persona son suyos, aunque estén en tu conversación',
  );

  assert.equal(exportado.profile.id, ana.id);
  assert.equal(exportado.reactions.length, 1);
  assert.equal(exportado.stars.length, 1);
  assert.equal(exportado.memberships.length, 1);
  assert.ok(exportado.notIncluded, 'debe decir qué no lleva, para no dar falsa sensación');
});

test('la exportación llega ordenada de lo más antiguo a lo más reciente', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  await sendMessages(conversation.id, ana.id, ['primero', 'segundo', 'tercero']);

  const exportado = await exportAccount(ana);
  assert.deepEqual(
    exportado.messages.map((m) => m.content),
    ['primero', 'segundo', 'tercero'],
  );
});
