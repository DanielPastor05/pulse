/**
 * Service worker: the only thing that keeps running once the tab is gone.
 *
 * Deliberately does no caching. A chat is worthless served stale, and a cache
 * layer here is a whole class of "why am I seeing yesterday's messages" bugs
 * for no benefit. This exists solely to receive pushes and open the right
 * conversation when one is tapped.
 */

self.addEventListener('install', () => {
  // Take over straight away rather than waiting for every old tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return; // not ours
  }

  const title = payload.title || 'Pulse';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Repeats from one conversation replace each other instead of stacking.
      tag: payload.tag || 'pulse',
      renotify: Boolean(payload.tag),
      data: { url: payload.url || '/chat' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/chat';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Reuse a tab that is already open — opening a second copy of the app
      // beside the one you were reading is the wrong outcome.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
