import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { purgeStoredFiles } from '@/server/services/account.service';
import { cleanupOrphans, storagePath } from '@/server/services/cleanup.service';
import { makeConversation, makeUser, prisma, sendMessages, teardown } from './setup.ts';
import { hoursAgo, storageDouble } from './storage-double.ts';

after(teardown);

const BASE = 'https://proyecto.supabase.co/storage/v1/object/public';
const avatarUrl = (path: string) => `${BASE}/avatars/${path}`;

/** Un adjunto real, con su fila y su objeto, para que la limpieza tenga qué respetar. */
async function attach(messageId: string, path: string) {
  return prisma.attachment.create({
    data: {
      messageId,
      path,
      kind: 'IMAGE',
      url: `${BASE}/attachments/${path}`,
      name: path.split('/').at(-1) ?? 'file',
      size: 1234,
      mimeType: 'image/png',
    },
  });
}

// --- Borrado de cuenta -------------------------------------------------------

test('borrar la cuenta se lleva los dos buckets y no toca los de otra persona', async () => {
  const storage = storageDouble({
    attachments: {
      'ana/foto.png': hoursAgo(50),
      'ana/nota.webm': hoursAgo(2),
      'beto/suyo.png': hoursAgo(50),
    },
    avatars: {
      'ana/cara.png': hoursAgo(50),
      'beto/cara.png': hoursAgo(50),
    },
  });

  const removed = await purgeStoredFiles('ana', storage);

  assert.equal(removed, 3, 'dos adjuntos y un avatar');
  assert.deepEqual(storage.paths('attachments'), ['beto/suyo.png']);
  assert.deepEqual(storage.paths('avatars'), ['beto/cara.png']);
});

test('el barrido no deja atrás nada aunque haya más objetos que una página', async () => {
  // 250 fuerza tres vueltas con el lote de 100: si la paginación estuviera mal,
  // aquí quedarían 150 y la cuenta se borraría igual, en silencio.
  const files: Record<string, string> = {};
  for (let i = 0; i < 250; i += 1) files[`ana/f${String(i).padStart(3, '0')}.png`] = hoursAgo(50);

  const storage = storageDouble({ attachments: files });
  const removed = await purgeStoredFiles('ana', storage);

  assert.equal(removed, 250);
  assert.deepEqual(storage.paths('attachments'), []);
});

test(
  'el barrido se rinde en vez de dar vueltas cuando el borrado no surte efecto',
  { timeout: 5_000 },
  async () => {
    // Exactamente una página llena. `remove` dice que sí y no borra, que es lo
    // que hace Supabase con una política que deniega: sin la comprobación de
    // avance, la siguiente vuelta lista los mismos cien para siempre — dentro de
    // la petición que borra una cuenta.
    const files: Record<string, string> = {};
    for (let i = 0; i < 100; i += 1) files[`ana/f${String(i).padStart(3, '0')}.png`] = hoursAgo(50);

    const storage = storageDouble({ attachments: files });
    storage.refuseRemovesSilently();

    await assert.rejects(
      () => purgeStoredFiles('ana', storage),
      /no avanza/,
      'debe fallar de forma visible, no colgarse',
    );
  },
);

// --- Limpieza periódica ------------------------------------------------------

test('la limpieza borra el adjunto huérfano y respeta el que sigue vivo', async () => {
  const ana = await makeUser('ana');
  const sala = await makeConversation(ana.id);
  const [mensaje] = await sendMessages(sala.id, ana.id, ['con foto']);
  assert.ok(mensaje);

  const vivo = `${ana.id}/vivo.png`;
  await attach(mensaje.id, vivo);

  const storage = storageDouble({
    attachments: {
      [vivo]: hoursAgo(50),
      [`${ana.id}/huerfano.png`]: hoursAgo(50),
      // Subida en vuelo: sin fila todavía, pero puede estar enviándose ahora.
      [`${ana.id}/reciente.png`]: hoursAgo(1),
    },
  });

  const result = await cleanupOrphans(storage);

  assert.equal(result.attachments, 1);
  assert.deepEqual(storage.paths('attachments'), [vivo, `${ana.id}/reciente.png`].sort());
});

test('la limpieza borra el avatar anterior y respeta el actual, también el de un grupo', async () => {
  const ana = await makeUser('ana');
  const actual = `${ana.id}/cara-nueva.png`;
  await prisma.user.update({ where: { id: ana.id }, data: { avatarUrl: avatarUrl(actual) } });

  // El icono de un grupo sale del mismo selector y vive en el mismo bucket.
  // Mirando sólo `User.avatarUrl` esto lo borraría a las veinticuatro horas.
  const sala = await makeConversation(ana.id, { name: 'Equipo' });
  const iconoGrupo = `${ana.id}/equipo.png`;
  await prisma.conversation.update({
    where: { id: sala.id },
    data: { avatarUrl: avatarUrl(iconoGrupo) },
  });

  const storage = storageDouble({
    avatars: {
      [actual]: hoursAgo(50),
      [iconoGrupo]: hoursAgo(50),
      [`${ana.id}/cara-vieja.png`]: hoursAgo(50),
    },
  });

  const result = await cleanupOrphans(storage);

  assert.equal(result.avatars, 1, 'sólo la que ya no usa nadie');
  assert.deepEqual(storage.paths('avatars'), [actual, iconoGrupo].sort());
});

test('un avatar externo no protege nada ni impide limpiar', async () => {
  const ana = await makeUser('ana');
  // La foto que trae una cuenta de Google: es una URL válida y no hay ningún
  // objeto nuestro detrás.
  await prisma.user.update({
    where: { id: ana.id },
    data: { avatarUrl: 'https://lh3.googleusercontent.com/a/foto=s96-c' },
  });

  const storage = storageDouble({ avatars: { [`${ana.id}/subida.png`]: hoursAgo(50) } });
  const result = await cleanupOrphans(storage);

  assert.equal(result.avatars, 1);
  assert.deepEqual(storage.paths('avatars'), []);
});

test('storagePath saca la ruta de una URL nuestra y descarta las demás', () => {
  assert.equal(storagePath(avatarUrl('u1/cara.png'), 'avatars'), 'u1/cara.png');
  // Codificada, que es como la devuelve `getPublicUrl`, y con parámetros colgando.
  assert.equal(storagePath(`${BASE}/avatars/u1/mi%20cara.png?width=64`, 'avatars'), 'u1/mi cara.png');
  // Del otro bucket: no es un avatar vivo, y confundirlos protegería lo que no toca.
  assert.equal(storagePath(`${BASE}/attachments/u1/foto.png`, 'avatars'), null);
  assert.equal(storagePath('https://lh3.googleusercontent.com/a/foto', 'avatars'), null);
  assert.equal(storagePath(null, 'avatars'), null);
});
