import 'server-only';

import { cookies, headers } from 'next/headers';
import type { Locale } from '@prisma/client';

import { LOCALE_COOKIE } from '@/i18n/provider';
import { messages as en, type Messages } from '@/i18n/en';
import { messages as es } from '@/i18n/es';

const SUPPORTED: Locale[] = ['EN', 'ES'];
const BUNDLES: Record<Locale, Messages> = { EN: en, ES: es };

/**
 * Qué idioma pintar en el servidor, antes de que exista sesión.
 *
 * Tres fuentes, en este orden y por este motivo:
 *
 * 1. **La cookie.** Es la elección explícita de esta persona, y una elección
 *    explícita gana siempre — también sobre lo que diga su navegador.
 * 2. **`Accept-Language`.** Para quien llega por primera vez. Adivinar mal es
 *    barato porque hay un selector a un clic; no adivinar es peor, porque deja
 *    en inglés a alguien cuyo navegador ya dijo que habla español.
 * 3. **Inglés**, que es en lo que está escrito el original.
 *
 * Dentro de la aplicación con sesión manda la fila del usuario, que es la que
 * viaja entre dispositivos. La cookie se sincroniza al elegir.
 */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value?.toUpperCase();
  if (fromCookie && SUPPORTED.includes(fromCookie as Locale)) return fromCookie as Locale;

  const accept = (await headers()).get('accept-language') ?? '';

  // No hace falta interpretar los factores de calidad: basta con cuál de los
  // idiomas que soportamos aparece antes, que es lo que el navegador ya ordenó.
  const primero = accept
    .split(',')
    .map((parte) => parte.split(';')[0]?.trim().slice(0, 2).toUpperCase())
    .find((codigo) => codigo && SUPPORTED.includes(codigo as Locale));

  return (primero as Locale) ?? 'EN';
}

/**
 * Los textos, para lo que se pinta en el servidor.
 *
 * El equivalente de `useT()` donde no hay hooks: la página de error, la de
 * «no existe» y el marco de las pantallas de entrada son componentes de
 * servidor, y hasta ahora eso las condenaba a quedarse en inglés.
 */
export async function getMessages(): Promise<Messages> {
  return BUNDLES[await resolveLocale()] ?? en;
}
