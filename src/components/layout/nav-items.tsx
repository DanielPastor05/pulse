'use client';

import { Compass, MessagesSquare, Settings, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { SoloTexto } from '@/i18n/en';

export type NavItem = {
  href: string;
  /** Clave del diccionario, no el texto: aqui todavia no se sabe el idioma. */
  label: SoloTexto<'nav'>;
  icon: LucideIcon;
  /** Highlight for any nested route, not just an exact match. */
  match: (pathname: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/chat',
    label: 'chats',
    icon: MessagesSquare,
    match: (pathname) => pathname === '/chat' || pathname.startsWith('/chat/'),
  },
  {
    href: '/discover',
    label: 'discover',
    icon: Compass,
    match: (pathname) => pathname.startsWith('/discover'),
  },
  {
    href: '/starred',
    label: 'starred',
    icon: Star,
    match: (pathname) => pathname.startsWith('/starred'),
  },
  {
    href: '/settings',
    label: 'settings',
    icon: Settings,
    match: (pathname) => pathname.startsWith('/settings'),
  },
];
