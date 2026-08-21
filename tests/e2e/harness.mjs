/**
 * Shared plumbing for the end-to-end suites.
 *
 * These run against a real dev server and the real Supabase project, because
 * the things they check — block enforcement, rate limiting, storage MIME rules,
 * notification preferences — only exist once the request has gone through
 * middleware, the route handler, Prisma and Postgres. A mock of any of those
 * would be testing the mock.
 *
 * Every account created here is deleted on the way out.
 */
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync } from 'node:fs';

export const APP = process.env.E2E_APP_URL ?? 'http://localhost:3000';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const admin = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const createdUserIds = [];

/** Creates a confirmed account and signs it in. */
export async function makeUser(tag) {
  const email = `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@probe.test`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-9aZ!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  createdUserIds.push(data.user.id);

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signed, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`signIn(${tag}): ${signInError.message}`);

  return { id: data.user.id, email, session: signed.session, tag };
}

/**
 * Builds the auth cookie the app expects.
 *
 * @supabase/ssr owns that format, so it writes it: we hand it an in-memory jar
 * and capture whatever it emits. Hand-rolling the cookie means guessing at an
 * encoding that is free to change between releases.
 */
async function cookieFor(user) {
  if (user.cookie) return user.cookie;

  const jar = [];
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => jar,
      setAll: (list) => {
        for (const { name, value } of list) {
          const index = jar.findIndex((entry) => entry.name === name);
          if (index >= 0) jar[index] = { name, value };
          else jar.push({ name, value });
        }
      },
    },
  });

  await client.auth.setSession({
    access_token: user.session.access_token,
    refresh_token: user.session.refresh_token,
  });

  user.cookie = jar.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join('; ');
  if (!user.cookie) throw new Error(`no session cookie produced for ${user.tag}`);
  return user.cookie;
}

/** Calls the app as `actor`. `origin` is set because the API checks it. */
export async function api(path, { method = 'GET', body, actor } = {}) {
  const response = await fetch(`${APP}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: APP,
      cookie: await cookieFor(actor),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: response.status, json };
}

/** Gives a fresh account the profile row the rest of the app requires. */
export async function onboard(user) {
  const result = await api('/api/me/onboarding', {
    method: 'POST',
    actor: user,
    body: {
      username: `${user.tag}${Date.now().toString().slice(-7)}`,
      displayName: user.tag,
      accent: 'electric',
    },
  });
  if (result.status !== 200) {
    throw new Error(`onboarding(${user.tag}) -> ${result.status} ${JSON.stringify(result.json)}`);
  }
  return result.json;
}

/**
 * Borra las cuentas de prueba **y las conversaciones que dejan atrás**.
 *
 * Borrar un usuario quita su fila de `conversation_members`, pero no toca la
 * conversación. Cuando se va el último miembro queda un grupo sin nadie
 * dentro: invisible desde la aplicación, porque todo filtra por pertenencia, y
 * con todos sus mensajes y adjuntos todavía ahí.
 *
 * No es teórico. Al medirlo el 21/08/2026, la base de producción tenía **616
 * de 639 conversaciones huérfanas** con 4549 mensajes — el 95% de la tabla era
 * escombro de bancos, acumulado desde el 12 de agosto sin que nadie lo viera.
 *
 * Sólo se borran las conversaciones donde estaba una cuenta *de esta
 * ejecución*, y sólo si se quedan sin nadie. Barrer todas las huérfanas sería
 * más simple y más peligroso: estas suites se ejecutan contra producción, y un
 * arnés de pruebas no debe borrar nada que no haya creado él.
 */
export async function cleanup() {
  const ids = createdUserIds.splice(0);
  if (ids.length === 0) return;

  // Hay que preguntarlo antes: al borrar las cuentas desaparecen las filas de
  // pertenencia, y con ellas la única pista de dónde estuvieron.
  const { data: pertenencias } = await admin
    .from('conversation_members')
    .select('conversationId')
    .in('userId', ids);
  const tocadas = [...new Set((pertenencias ?? []).map((fila) => fila.conversationId))];

  for (const id of ids) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }

  for (const conversationId of tocadas) {
    const { count } = await admin
      .from('conversation_members')
      .select('*', { count: 'exact', head: true })
      .eq('conversationId', conversationId);

    // `count` nulo significa que la consulta falló, no que no haya nadie. Ante
    // la duda no se borra: dejar basura es recuperable, borrar de más no.
    if (count === 0) {
      await admin.from('conversations').delete().eq('id', conversationId);
    }
  }
}

/**
 * Las cuentas se borran también cuando algo revienta a mitad.
 *
 * Antes sólo se borraban en el camino feliz: cada banco termina con un
 * `await cleanup()` de nivel superior, y si algo lanzaba antes de llegar ahí,
 * Node se llevaba el proceso y las cuentas se quedaban — con sus
 * conversaciones y sus mensajes dentro.
 *
 * No es hipotético. Así fue como la base de producción acumuló 525 mensajes de
 * relleno de bancos que nadie limpió, repartidos en cientos de conversaciones
 * fantasma. Nadie los veía desde la aplicación, porque la búsqueda filtra por
 * pertenencia, así que el problema creció en silencio durante semanas.
 *
 * Estos ficheros son scripts con `await` de nivel superior y no funciones, así
 * que no hay un cuerpo donde poner un `try/finally` sin envolver cada uno
 * entero. Engancharse al fallo del proceso cubre los ocho desde un solo sitio.
 *
 * `cleanup()` vacía la lista al recorrerla, así que llamarla dos veces —una
 * aquí y otra al final del banco— no hace nada la segunda vez.
 */
let limpiando = false;
for (const evento of ['uncaughtException', 'unhandledRejection']) {
  process.on(evento, async (error) => {
    if (limpiando) return;
    limpiando = true;

    console.error(`\n${error?.stack ?? error}`);
    await cleanup().catch(() => {});
    console.error('cuentas de prueba borradas pese al fallo');
    process.exit(1);
  });
}

/** Fails the process on a false assertion, so a broken guarantee is a red run. */
export function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label} -> ${actual}${ok ? '' : ` (esperado ${expected})`}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

export async function requireServer() {
  try {
    const response = await fetch(`${APP}/login`);
    if (!response.ok) throw new Error(String(response.status));
  } catch {
    console.error(`No hay servidor en ${APP}. Arranca 'npm run dev' primero.`);
    process.exit(1);
  }
}
