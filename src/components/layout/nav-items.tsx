'use client';

import { Compass, MessagesSquare, Settings, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Highlight for any nested route, not just an exact match. */
  match: (pathname: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/chat',
    label: 'Chats',
    icon: MessagesSquare,
    match: (pathname) => pathname === '/chat' || pathname.startsWith('/chat/'),
  },
  {
    href: '/discover',
    label: 'Discover',
    icon: Compass,
    match: (pathname) => pathname.startsWith('/discover'),
  },
  {
    href: '/starred',
    label: 'Starred',
    icon: Star,
    match: (pathname) => pathname.startsWith('/starred'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (pathname) => pathname.startsWith('/settings'),
  },
];
