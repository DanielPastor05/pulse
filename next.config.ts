import bundleAnalyzer from '@next/bundle-analyzer';
import type { NextConfig } from 'next';

/**
 * Supabase Storage serves public objects from `<project>.supabase.co/storage/v1/object/public/...`.
 * We derive the allowed image host from the public env var so no hardcoded domain leaks in.
 */
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname;
  } catch {
    return 'placeholder.supabase.co';
  }
})();

const supabaseOrigin = `https://${supabaseHost}`;
const supabaseSocket = `wss://${supabaseHost}`;
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // Sólo al construir la imagen de Docker. `standalone` produce un bundle que
  // arranca sin node_modules, que es lo que hace la imagen pequeña — pero en
  // Vercel estorba, porque su propio empaquetado ya hace ese trabajo y las dos
  // cosas a la vez se pisan.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
    /*
     * Aquí no hay entrada para GIPHY, y es a propósito.
     *
     * Los GIF y los stickers se pintan con un `<img>` normal y no con
     * `next/image`: el optimizador serviría un fotograma estático de un GIF
     * animado, que es exactamente lo contrario de lo que hace falta. Como no
     * pasan por él, `remotePatterns` no los mira.
     *
     * Había una entrada para `media.tenor.com` que tampoco hacía nada, por lo
     * mismo, y que además nombraba a un proveedor que ya no se usa. Se quitó al
     * cambiar a GIPHY: una lista de permisos que nombra algo que no existe
     * confunde a quien la lee sobre por dónde pasan las imágenes.
     */
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          // Every directive here is spelled out on purpose. `default-src` is the
          // fallback for any directive you omit — leaving out `script-src` does
          // not mean "no rule for scripts", it means scripts inherit
          // `default-src 'self'`, which blocks Next's inline bootstrap and stops
          // React from hydrating at all. Same trap for `connect-src`: omit it
          // and every call to Supabase, including the Realtime socket, is denied.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next inlines its bootstrap and flight payloads. Removing
              // 'unsafe-inline' needs per-request nonces, which would opt every
              // static page into dynamic rendering. Dev also evals for HMR.
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "font-src 'self' data:",
              `connect-src 'self' ${supabaseOrigin} ${supabaseSocket}${isDev ? ' ws://localhost:*' : ''}`,
              "worker-src 'self' blob:",
              // The four that close real holes and cost nothing.
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "form-action 'self'",
            ].join('; '),
          },
          // Told to browsers only over HTTPS; harmless on local http, and the
          // platform edge is what actually terminates TLS in production.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

/** Opt-in, so ordinary builds are untouched: `ANALYZE=true npm run build`. */
export default bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })(nextConfig);
