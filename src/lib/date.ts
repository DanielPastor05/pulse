import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isToday,
  isYesterday,
} from 'date-fns';

/** Compact stamp for conversation rows: 09:41 → Yesterday → Mon → 12/03/25. */
export function formatListTime(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEE');
  return format(date, 'dd/MM/yy');
}

/** Exact time under a message bubble. */
export function formatBubbleTime(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

/** Sticky separator between days. */
export function formatDaySeparator(iso: string): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, 'EEEE');
  return format(date, 'd MMMM yyyy');
}

export function formatRelative(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function formatFullTimestamp(iso: string): string {
  return format(new Date(iso), "d MMM yyyy 'at' HH:mm");
}

export function isSameDayIso(a: string, b: string): boolean {
  return isSameDay(new Date(a), new Date(b));
}

/** "last seen 4 minutes ago" — or nothing at all when they are online. */
export function formatLastSeen(iso: string): string {
  const date = new Date(iso);
  if (Date.now() - date.getTime() < 60_000) return 'active just now';
  return `active ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}
