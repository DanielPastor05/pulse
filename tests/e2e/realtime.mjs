/**
 * The live path: does a message sent by one person reach the other's open
 * conversation without a refresh?
 *
 * This is the one guarantee the API-level suites cannot cover. Channels are
 * private and authorised by RLS on `realtime.messages`, so a mistake there does
 * not fail loudly — the REST API keeps working and the app simply stops feeling
 * live, which is easy to miss until two people are using it at once.
 *
 * Ana subscribes exactly as the browser does (`private: true`, after
 * `realtime.setAuth()`), Beto sends through the API, and Ana must receive it.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

import { api, check, cleanup, makeUser, onboard, requireServer, SUPABASE_URL } from './harness.mjs';

const anonKey = readFileSync('.env', 'utf8')
  .split('\n')
  .find((line) => line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
  .split('=')[1]
  .trim()
  .replace(/^["']|["']$/g, '');

await requireServer();

const ana = await makeUser('ana');
const beto = await makeUser('beto');
await onboard(ana);
await onboard(beto);

const group = await api('/api/conversations', {
  method: 'POST',
  actor: ana,
  body: { name: 'Prueba en vivo', accent: 'electric', memberIds: [beto.id] },
});
const conversationId = (group.json?.conversation ?? group.json)?.id;

/** A client carrying a real user session, like the browser has. */
function clientFor(user) {
  const client = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  client.realtime.setAuth(user.session.access_token);
  return client;
}

function waitFor(channel, event, ms = 15_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    channel.on('broadcast', { event }, ({ payload }) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function subscribed(channel, ms = 15_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('TIMEOUT'), ms);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        resolve(status);
      }
    });
  });
}

console.log('\nTiempo real: Ana escucha, Beto escribe');

const anaClient = clientFor(ana);
const anaChannel = anaClient.channel(`conversation:${conversationId}`, {
  config: { private: true },
});

const incoming = waitFor(anaChannel, 'message.created');
check('Ana se suscribe al canal privado', await subscribed(anaChannel), 'SUBSCRIBED');

const sent = await api(`/api/conversations/${conversationId}/messages`, {
  method: 'POST',
  actor: beto,
  body: { content: 'Esto tiene que aparecerte sin recargar.' },
});
check('Beto envia por la API', sent.status, 201);

const payload = await incoming;
check('a Ana le llega el evento en vivo', payload !== null, true);
check(
  'y trae el texto correcto',
  payload?.message?.content ?? null,
  'Esto tiene que aparecerte sin recargar.',
);

// Un intruso no debe poder escuchar esa conversacion.
const intruso = await makeUser('intruso');
await onboard(intruso);

const intrusoClient = clientFor(intruso);
const intrusoChannel = intrusoClient.channel(`conversation:${conversationId}`, {
  config: { private: true },
});
const estado = await subscribed(intrusoChannel, 12_000);
check('un no miembro NO consigue suscribirse', estado === 'SUBSCRIBED', false);

await anaClient.removeAllChannels();
await intrusoClient.removeAllChannels();
await cleanup();
console.log('\ncuentas de prueba borradas');
process.exit(process.exitCode ?? 0);
