import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isToday,
  isYesterday,
  type Locale as DateLocale,
} from 'date-fns';

/**
 * Los textos que no sabe date-fns.
 *
 * «ayer», «hoy» y «activo hace un momento» no son formatos de fecha, son frases
 * de la aplicación, así que salen del diccionario y no de la librería.
 */
export type DateStrings = {
  today: string;
  yesterday: string;
  activeJustNow: string;
  activeAgo: (when: string) => string;
  at: string;
};

/**
 * Formateadores atados a un idioma.
 *
 * Una fábrica y no seis funciones que lean un idioma global: estos componentes
 * son de cliente, pero un componente de cliente **también se renderiza en el
 * servidor** en la primera petición, y allí los módulos se comparten entre
 * peticiones concurrentes. Una variable de módulo le daría a alguien las fechas
 * en el idioma del visitante anterior — un fallo que en local no aparece nunca,
 * porque hace falta que dos peticiones de idiomas distintos se solapen.
 *
 * Puras y sin hooks para que se puedan probar sin montar React.
 */
export function createDateFormatters(locale: DateLocale, strings: DateStrings) {
  return {
    /** Sello compacto de la lista: 09:41 → Ayer → lun → 12/03/25. */
    formatListTime(iso: string): string {
      const date = new Date(iso);
      if (isToday(date)) return format(date, 'HH:mm', { locale });
      if (isYesterday(date)) return strings.yesterday;
      if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEE', { locale });
      return format(date, 'dd/MM/yy', { locale });
    },

    /** Separador fijo entre días. */
    formatDaySeparator(iso: string): string {
      const date = new Date(iso);
      if (isToday(date)) return strings.today;
      if (isYesterday(date)) return strings.yesterday;
      if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEEE', { locale });
      return format(date, 'd MMMM yyyy', { locale });
    },

    formatRelative(iso: string): string {
      return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale });
    },

    formatFullTimestamp(iso: string): string {
      return `${format(new Date(iso), 'd MMM yyyy', { locale })} ${strings.at} ${format(new Date(iso), 'HH:mm', { locale })}`;
    },

    /** «activo hace 4 minutos» — o nada, cuando la persona está en línea. */
    formatLastSeen(iso: string): string {
      const date = new Date(iso);
      if (Date.now() - date.getTime() < 60_000) return strings.activeJustNow;
      return strings.activeAgo(formatDistanceToNowStrict(date, { addSuffix: true, locale }));
    },
  };
}

/** La hora exacta bajo una burbuja. No depende del idioma. */
export function formatBubbleTime(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

export function isSameDayIso(a: string, b: string): boolean {
  return isSameDay(new Date(a), new Date(b));
}
