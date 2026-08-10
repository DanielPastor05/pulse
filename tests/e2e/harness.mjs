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

export async function cleanup() {
  for (const id of createdUserIds.splice(0)) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
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
