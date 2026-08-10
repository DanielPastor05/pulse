import { z } from 'zod';

/**
 * A URL restricted to http(s).
 *
 * `z.string().url()` accepts `javascript:`, `data:` and `vbscript:` because it
 * only asks whether `new URL()` parses — and those all parse. Any of them
 * stored in a field that later becomes an `href` is a stored-XSS primitive, so
 * every user-supplied URL (attachments, avatars, group images) goes through
 * this instead.
 */
export const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Only http and https URLs are allowed.' },
  );
