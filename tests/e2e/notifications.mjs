/**
 * The notification toggles in Settings have to actually gate delivery.
 *
 * They used to be stored, shown, and ignored: `notify()` filtered muted
 * conversations but never read `notifyOnMessage` / `notifyOnMention` /
 * `notifyOnReaction`, so turning one off changed nothing.
 *
 * Note the schema default for `notifyOnReaction` is false — reaction pings are
 * opt-in — so the first case checks the default is honoured rather than
 * assuming notifications flow.
 */
import { PrismaClient } from '@prisma/client';

import { api, check, cleanup, makeUser, onboard, requireServer } from './harness.mjs';

const prisma = new PrismaClient();

await requireServer();

const ana = await makeUser('ana'); // recibe
const beto = await makeUser('beto'); // reacciona
await onboard(ana);
await onboard(beto);

const group = await api('/api/conversations', {
  method: 'POST',
  actor: ana,
  body: { name: 'Sala de avisos', accent: 'electric', memberIds: [beto.id] },
});
const conversationId = (group.json?.conversation ?? group.json)?.id;

const posted = await api(`/api/conversations/${conversationId}/messages`, {
  method: 'POST',
  actor: ana,
  body: { content: 'hola' },
});
const messageId = (posted.json?.message ?? posted.json)?.id;
if (!messageId) throw new Error(`sin id de mensaje: ${JSON.stringify(posted.json).slice(0, 200)}`);

const countReactions = () =>
  prisma.notification.count({ where: { userId: ana.id, kind: 'REACTION' } });

/** Reactions toggle, so each call needs a different emoji to keep adding. */
async function react(emoji) {
  const result = await api(`/api/messages/${messageId}/reactions`, {
    method: 'POST',
    actor: beto,
    body: { emoji },
  });
  if (result.status !== 200) {
    throw new Error(`react(${emoji}) -> ${result.status} ${JSON.stringify(result.json)}`);
  }
  // The notification is written after the response is sent.
  await new Promise((resolve) => setTimeout(resolve, 700));
}

async function delta(fn, action) {
  const before = await fn();
  await action();
  return (await fn()) - before;
}

console.log('\nPreferencias de notificacion');

check(
  'avisos con la preferencia en su valor por defecto (false)',
  await delta(countReactions, () => react('🙂')),
  0,
);

const on = await api('/api/me', { method: 'PATCH', actor: ana, body: { notifyOnReaction: true } });
check('encender el interruptor', on.status, 200);
check('avisos con la preferencia encendida', await delta(countReactions, () => react('👍')), 1);

const off = await api('/api/me', {
  method: 'PATCH',
  actor: ana,
  body: { notifyOnReaction: false },
});
check('apagar el interruptor', off.status, 200);
check('avisos con la preferencia apagada', await delta(countReactions, () => react('🔥')), 0);

// Guards against over-filtering: a different toggle must be unaffected.
const countMessages = () => prisma.notification.count({ where: { userId: ana.id, kind: 'MESSAGE' } });
check(
  'avisos de MENSAJE (interruptor distinto, sigue activo)',
  await delta(countMessages, async () => {
    await api(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      actor: beto,
      body: { content: 'sigo pudiendo escribir' },
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
  }),
  1,
);

await cleanup();
await prisma.$disconnect();
console.log('\ncuentas de prueba borradas');
