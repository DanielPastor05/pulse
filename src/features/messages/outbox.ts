'use client';

import type { AttachmentInput } from '@/features/messages/validators';

/**
 * Messages written while offline, kept until they are actually sent.
 *
 * Two things make this safe rather than a duplicate-message machine:
 *
 *  - the send is idempotent by `clientId`, backed by a unique index on
 *    `(authorId, clientId)`, so flushing the same entry twice — after a reload,
 *    or from two tabs at once — resolves to one message;
 *  - entries only leave the queue once the server has confirmed them.
 *
 * `localStorage` rather than memory because the common case is not a brief
 * blip: it is losing signal, locking the phone, and coming back later.
 * Attachments are excluded — they are already uploaded to storage by the time a
 * message references them, so only the reference travels.
 */

const KEY = 'pulse.outbox.v1';
const MAX_ENTRIES = 100;

export type OutboxEntry = {
  clientId: string;
  conversationId: string;
  content: string;
  attachments: AttachmentInput[];
  replyToId: string | null;
  queuedAt: number;
};

function read(): OutboxEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    // Corrupt or full storage must not take the composer down with it.
    return [];
  }
}

function write(entries: OutboxEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Quota exceeded, or storage disabled. Dropping the queue is better than
    // throwing from a send.
  }
}

export function enqueue(entry: OutboxEntry) {
  const entries = read().filter((item) => item.clientId !== entry.clientId);
  write([...entries, entry]);
}

export function dequeue(clientId: string) {
  write(read().filter((entry) => entry.clientId !== clientId));
}

export function pending(conversationId?: string): OutboxEntry[] {
  const entries = read();
  return conversationId
    ? entries.filter((entry) => entry.conversationId === conversationId)
    : entries;
}

export function isQueued(clientId: string): boolean {
  return read().some((entry) => entry.clientId === clientId);
}

/** Treated as offline when the browser says so; it is a hint, not a promise. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
