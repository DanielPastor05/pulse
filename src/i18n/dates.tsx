'use client';

import * as React from 'react';
import { enUS, es } from 'date-fns/locale';
import type { Locale } from '@prisma/client';

import { createDateFormatters } from '@/lib/date';
import { useLocale, useT } from '@/i18n/provider';

const DATE_LOCALES = { EN: enUS, ES: es } satisfies Record<Locale, typeof enUS>;

/**
 * Las fechas, en el idioma de quien mira.
 *
 * Un hook y no una importación directa porque el idioma vive en el contexto de
 * React, que es por render. La alternativa —una variable de módulo que alguien
 * ponga al arrancar— se rompe en el servidor: estos componentes llevan
 * `'use client'`, pero aun así se renderizan en el servidor la primera vez, y
 * allí el módulo es el mismo para todas las peticiones a la vez.
 *
 * Devuelve las funciones con el nombre que ya tenían, así que en el sitio donde
 * se usan sólo cambia de dónde vienen.
 */
export function useDates() {
  const locale = useLocale();
  const t = useT();

  return React.useMemo(
    () =>
      createDateFormatters(DATE_LOCALES[locale] ?? enUS, {
        today: t.common.today,
        yesterday: t.common.yesterday,
        activeJustNow: t.common.activeJustNow,
        activeAgo: t.common.activeAgo,
        at: t.common.at,
      }),
    [locale, t.common],
  );
}
