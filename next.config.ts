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
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/**' },
      { protocol: 'https', hostname: 'media.tenor.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
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

export default nextConfig;
