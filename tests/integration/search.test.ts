import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { globalSearch } from '@/server/services/search.service';
import { makeConversation, makeUser, prisma, sendMessages, teardown } from './setup.ts';

after(teardown);

const contenidos = (resultado: Awaited<ReturnType<typeof globalSearch>>) =>
  resultado.messages.map((entry) => entry.message.content);

test('ordena por relevancia, no por lo reciente que sea', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);

  // El más denso se escribe primero: si el orden fuera por recencia saldría el
  // último, así que este test distingue las dos cosas.
  await sendMessages(conversation.id, ana.id, [
    'quasar quasar quasar por todas partes',
    'una frase larga que menciona quasar una sola vez entre muchas otras palabras',
  ]);

  const resultado = await globalSearch(ana.id, 'quasar', 'messages');
  const encontrados = contenidos(resultado);

  assert.equal(encontrados.length, 2);
  assert.ok(
    encontrados[0]?.startsWith('quasar quasar quasar'),
    'el que más veces lo menciona debe salir primero',
  );
});

test('encuentra a media palabra, para que buscar escribiendo funcione', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  await sendMessages(conversation.id, ana.id, ['hablemos de astronomía']);

  // Sin el prefijo `:*` esto no encontraría nada hasta la última letra.
  const parcial = await globalSearch(ana.id, 'astronom', 'messages');
  assert.equal(contenidos(parcial).length, 1);
});

test('varias palabras exigen que estén todas', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  await sendMessages(conversation.id, ana.id, [
    'nebulosa de Orión',
    'nebulosa sin más',
    'Orión sin más',
  ]);

  const ambas = await globalSearch(ana.id, 'nebulosa orion', 'messages');
  // «Orión» lleva tilde y `simple` no la normaliza, así que este caso además
  // documenta el límite: buscar sin tilde no encuentra la palabra con ella.
  assert.equal(contenidos(ambas).length, 0);

  const conTilde = await globalSearch(ana.id, 'nebulosa Orión', 'messages');
  assert.deepEqual(contenidos(conTilde), ['nebulosa de Orión']);
});

test('una consulta de dos letras sigue encontrando dentro de una palabra', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  await sendMessages(conversation.id, ana.id, ['constelación']);

  // Por debajo de tres caracteres manda el trigrama: `tsquery` no tiene lexema
  // que casar ahí, pero «la» dentro de «constelación» sí se encuentra.
  const corta = await globalSearch(ana.id, 'la', 'messages');
  assert.equal(contenidos(corta).length, 1);
});

test('la búsqueda no cruza a conversaciones de las que no eres miembro', async () => {
  const ana = await makeUser('ana');
  const ajena = await makeUser('ajena');
  const suya = await makeConversation(ajena.id);
  await sendMessages(suya.id, ajena.id, ['secreto pulsar bien guardado']);

  const resultado = await globalSearch(ana.id, 'pulsar', 'messages');
  assert.deepEqual(contenidos(resultado), [], 'no debe ver lo que no es suyo');

  // Y quien sí es miembro lo encuentra: sin esto el test pasaría igual con la
  // búsqueda completamente rota.
  const dueña = await globalSearch(ajena.id, 'pulsar', 'messages');
  assert.equal(contenidos(dueña).length, 1);
});

test('los mensajes borrados desaparecen de los resultados', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  const [mensaje] = await sendMessages(conversation.id, ana.id, ['supernova visible']);
  assert.ok(mensaje);

  assert.equal(contenidos(await globalSearch(ana.id, 'supernova', 'messages')).length, 1);

  await prisma.message.update({ where: { id: mensaje.id }, data: { deletedAt: new Date() } });
  assert.equal(contenidos(await globalSearch(ana.id, 'supernova', 'messages')).length, 0);
});

test('sin resultados suficientes para llenar la página no ofrece cursor', async () => {
  const ana = await makeUser('ana');
  const conversation = await makeConversation(ana.id);
  await sendMessages(conversation.id, ana.id, ['cometa solitario']);

  const resultado = await globalSearch(ana.id, 'cometa', 'messages');
  assert.equal(
    resultado.nextCursor,
    null,
    'ofrecer «cargar más» para no traer nada es peor que no ofrecerlo',
  );
});
