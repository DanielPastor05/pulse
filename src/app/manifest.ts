import type { MetadataRoute } from 'next';

import { APP_NAME, APP_TAGLINE } from '@/lib/constants';

/**
 * Makes the app installable.
 *
 * Worth having on its own — from the home screen it opens without a browser
 * bar, which is how a chat app is actually used on a phone. It is also a hard
 * requirement on iOS: Safari only allows web push for apps added to the home
 * screen, so without this there are no notifications on an iPhone at all.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description:
      'A realtime messaging workspace with threads, groups, presence and search — fast, private and beautiful.',
    start_url: '/chat',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['social', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops these to the launcher's shape, so they carry their own
      // padding; shipping only `any` icons gets the glyph shaved at the corners.
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
