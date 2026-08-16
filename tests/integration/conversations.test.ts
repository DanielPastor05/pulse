import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import {
  getSummariesFor,
  listConversations,
  requireMembership,
} from '@/server/repositories/conversation.repository';
import { makeConversation, makeUser, prisma, sendMessages, teardown } from './setup.ts';

after(teardown);

/**
 * El resumen de una conversación, comprobando de paso que llegó.
 *
 * Sin esto cada aserción necesitaría una aserción no nula, que se lee como
 * ruido y además esconde el caso en que la consulta no devuelve nada — que es
 * un fallo distinto y merece decirlo.
 */
async function resumenDe(conversationId: string, viewerId: string) {
  const [resumen] = await getSummariesFor([conversationId], viewerId);
  assert.ok(resumen, 'la consulta no devolvió ningún resumen');
  return resumen;
}

test('el contador de no leídos ignora tus propios mensajes', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const conversation = await makeConversation(ana.id, { members: [beto.id] });

  await sendMessages(conversation.id, ana.id, ['mío uno', 'mío dos']);
  await sendMessages(conversation.id, beto.id, ['suyo uno', 'suyo dos', 'suyo tres']);

  const paraAna = await resumenDe(conversation.id, ana.id);
  assert.equal(paraAna.unreadCount, 3, 'Ana no debería contarse a sí misma');

  const paraBeto = await resumenDe(conversation.id, beto.id);
  assert.equal(paraBeto.unreadCount, 2);
});

test('marcar como leído pone el contador a cero, y sólo para quien lee', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const conversation = await makeConversation(ana.id, { members: [beto.id] });
  await sendMessages(conversation.id, beto.id, ['uno', 'dos']);

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: conversation.id, userId: ana.id } },
    data: { lastReadAt: new Date() },
  });

  const paraAna = await resumenDe(conversation.id, ana.id);
  assert.equal(paraAna.unreadCount, 0);

  // Beto no ha leído los suyos, pero tampoco cuentan: son suyos.
  const paraBeto = await resumenDe(conversation.id, beto.id);
  assert.equal(paraBeto.unreadCount, 0);
});

test('un mensaje borrado deja de contar como no leído', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const conversation = await makeConversation(ana.id, { members: [beto.id] });
  const [primero] = await sendMessages(conversation.id, beto.id, ['uno', 'dos']);
  assert.ok(primero);

  await prisma.message.update({ where: { id: primero.id }, data: { deletedAt: new Date() } });

  const paraAna = await resumenDe(conversation.id, ana.id);
  assert.equal(paraAna.unreadCount, 1);
});

test('getSummariesFor devuelve en el orden pedido y descarta lo ajeno', async () => {
  const ana = await makeUser('ana');
  const ajena = await makeUser('ajena');
  const uno = await makeConversation(ana.id, { name: 'uno' });
  const dos = await makeConversation(ana.id, { name: 'dos' });
  const deOtro = await makeConversation(ajena.id, { name: 'ajena' });

  const resumenes = await getSummariesFor([dos.id, uno.id, deOtro.id], ana.id);

  assert.deepEqual(
    resumenes.map((resumen) => resumen.id),
    [dos.id, uno.id],
    'debe respetar el orden de entrada y omitir la conversación de la que no es miembro',
  );
});

test('el resumen de un chat directo resuelve al interlocutor, no a ti', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const directa = await prisma.conversation.create({
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

  const paraAna = await resumenDe(directa.id, ana.id);
  assert.equal(paraAna.peer?.id, beto.id);
  assert.equal(paraAna.name, beto.displayName);

  const paraBeto = await resumenDe(directa.id, beto.id);
  assert.equal(paraBeto.peer?.id, ana.id);

  await prisma.conversation.delete({ where: { id: directa.id } });
});

test('un grupo no tiene interlocutor aunque cargue un miembro', async () => {
  const ana = await makeUser('ana');
  const beto = await makeUser('beto');
  const grupo = await makeConversation(ana.id, { members: [beto.id], name: 'Equipo' });

  const resumen = await resumenDe(grupo.id, ana.id);
  assert.equal(resumen.peer, null);
  assert.equal(resumen.name, 'Equipo');
  assert.equal(resumen.memberCount, 2, 'el contador viene de _count, no del include');
});

test('las favoritas van primero, y el resto por actividad', async () => {
  const ana = await makeUser('ana');
  const vieja = await makeConversation(ana.id, { name: 'vieja' });
  const nueva = await makeConversation(ana.id, { name: 'nueva' });
  const favorita = await makeConversation(ana.id, { name: 'favorita' });

  await prisma.conversation.update({
    where: { id: vieja.id },
    data: { lastMessageAt: new Date('2020-01-01') },
  });
  await prisma.conversation.update({
    where: { id: nueva.id },
    data: { lastMessageAt: new Date('2030-01-01') },
  });
  await prisma.conversation.update({
    where: { id: favorita.id },
    data: { lastMessageAt: new Date('2010-01-01') },
  });
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: favorita.id, userId: ana.id } },
    data: { favorite: true },
  });

  const lista = await listConversations(ana.id);
  const mias = lista.filter((item) => [vieja.id, nueva.id, favorita.id].includes(item.id));

  const [primera, segunda, tercera] = mias;
  assert.ok(primera && segunda && tercera, 'deberían aparecer las tres conversaciones');

  assert.equal(primera.id, favorita.id, 'la favorita va primero pese a ser la más antigua');
  assert.equal(segunda.id, nueva.id);
  assert.equal(tercera.id, vieja.id);
});

test('requireMembership rechaza a quien no es miembro', async () => {
  const ana = await makeUser('ana');
  const intrusa = await makeUser('intrusa');
  const conversation = await makeConversation(ana.id);

  await assert.rejects(
    () => requireMembership(conversation.id, intrusa.id),
    /not a member/i,
    'debe lanzar, no devolver null: un caller que olvide comprobarlo queda protegido igual',
  );

  const membership = await requireMembership(conversation.id, ana.id);
  assert.equal(membership.role, 'OWNER');
});

test('archivar saca la conversación del listado por defecto', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id, { name: 'archivable' });

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: conversation.id, userId: ana.id } },
    data: { archived: true },
  });

  const activas = await listConversations(ana.id);
  assert.equal(activas.some((item) => item.id === conversation.id), false);

  const archivadas = await listConversations(ana.id, { archived: true });
  assert.equal(archivadas.some((item) => item.id === conversation.id), true);
});
