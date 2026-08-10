'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';

import { cn } from '@/lib/utils';

const surfaceClasses = [
  'anim-pop surface-overlay z-50 min-w-[11rem] overflow-hidden rounded-[var(--radius-card)] p-1.5',
  'border border-[var(--hairline)]',
  'shadow-[var(--shadow-overlay)] outline-none',
].join(' ');

const itemClasses = [
  'group relative flex cursor-pointer select-none items-center gap-2.5 rounded-[var(--radius-field)]',
  'px-2.5 py-2 text-[13px] font-medium text-[var(--text-2)] outline-none',
  'transition-colors duration-100',
  'data-[highlighted]:bg-[var(--surface-hover)] data-[highlighted]:text-[var(--text-1)]',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-[var(--text-3)]',
  'data-[highlighted]:[&_svg]:text-[var(--accent)]',
].join(' ');

const dangerClasses =
  'text-[var(--danger)] data-[highlighted]:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] data-[highlighted]:text-[var(--danger)] [&_svg]:text-[var(--danger)] data-[highlighted]:[&_svg]:text-[var(--danger)]';

// --- Dropdown ---------------------------------------------------------------

export const Menu = DropdownMenuPrimitive.Root;
export const MenuTrigger = DropdownMenuPrimitive.Trigger;

export function MenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(surfaceClasses, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { danger?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(itemClasses, danger && dangerClasses, className)}
      {...props}
    />
  );
}

export function MenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-2.5 py-1.5 label-caps', className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--hairline)]', className)}
      {...props}
    />
  );
}

// --- Context menu -----------------------------------------------------------

export const ContextMenu = ContextMenuPrimitive.Root;
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

export function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content className={cn(surfaceClasses, className)} {...props} />
    </ContextMenuPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & { danger?: boolean }) {
  return (
    <ContextMenuPrimitive.Item
      className={cn(itemClasses, danger && dangerClasses, className)}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--hairline)]', className)}
      {...props}
    />
  );
}
