'use client';

import * as React from 'react';
import type { Locale } from '@prisma/client';

import { messages as en, type Messages } from '@/i18n/en';
import { messages as es } from '@/i18n/es';

const BUNDLES: Record<Locale, Messages> = { EN: en, ES: es };

/** El nombre de cada idioma, en su propio idioma. Nunca traducido. */
export const LOCALE_LABELS: Record<Locale, string> = { EN: 'English', ES: 'Español' };

export const LOCALE_COOKIE = 'pulse-locale';

const LocaleContext = React.createContext<{ locale: Locale; t: Messages } | null>(null);

/**
 * El idioma de la interfaz.
 *
 * Sin librería y sin segmento de idioma en la URL. Un `[locale]` en la ruta es
 * lo correcto cuando las páginas son públicas y se comparten —le da a Google
 * una URL por idioma— y aquí todo lo que importa está detrás de sesión, así que
 * pagaría reestructurar el árbol entero de rutas a cambio de nada.
 *
 * El diccionario se elige entero en vez de resolver clave a clave: son dos
 * objetos con la misma forma garantizada por el tipo, así que `t.call.answer`
 * es un acceso normal a una propiedad y TypeScript sabe que existe. Eso es lo
 * que hace que una traducción olvidada rompa la compilación.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ locale, t: BUNDLES[locale] ?? en }), [locale]);

  // El atributo `lang` no es decorativo: es lo que hace que un lector de
  // pantalla lea el texto con la pronunciación del idioma correcto, y lo que
  // decide qué diccionario usa el corrector del navegador.
  React.useEffect(() => {
    document.documentElement.lang = locale.toLowerCase();
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Los textos del idioma activo.
 *
 * Devuelve el diccionario entero y no una función `t('clave.con.puntos')`
 * porque una cadena con puntos no la comprueba nadie: se escribe mal y se
 * descubre en pantalla. `t.settings.language` se descubre al compilar.
 */
export function useT(): Messages {
  const value = React.useContext(LocaleContext);
  if (!value) throw new Error('useT necesita estar dentro de <LocaleProvider>.');
  return value.t;
}

export function useLocale(): Locale {
  const value = React.useContext(LocaleContext);
  if (!value) throw new Error('useLocale necesita estar dentro de <LocaleProvider>.');
  return value.locale;
}
