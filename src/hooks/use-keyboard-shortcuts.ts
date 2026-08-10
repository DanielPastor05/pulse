'use client';

import * as React from 'react';

export type Shortcut = {
  /** Lowercase `event.key`, e.g. 'k', 'escape', '/'. */
  key: string;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Fire even while a text field has focus (Escape, ⌘K …). */
  allowInInput?: boolean;
  handler: (event: KeyboardEvent) => void;
};

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  );
}

/**
 * Global key bindings. `meta` matches ⌘ on macOS and Ctrl elsewhere so the
 * same shortcut table works on both platforms.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const ref = React.useRef(shortcuts);
  ref.current = shortcuts;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;

      for (const shortcut of ref.current) {
        if (shortcut.key !== key) continue;
        if (Boolean(shortcut.meta) !== meta) continue;
        if (Boolean(shortcut.shift) !== event.shiftKey) continue;
        if (shortcut.alt !== undefined && shortcut.alt !== event.altKey) continue;
        if (!shortcut.allowInInput && isEditable(event.target)) continue;

        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/** True on Apple platforms — used to render ⌘ instead of Ctrl. */
export function useIsMac() {
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(navigator.userAgent));
  }, []);
  return isMac;
}
