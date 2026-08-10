'use client';

/**
 * Notification chime, synthesised with the Web Audio API.
 *
 * A two-note arpeggio through a short exponential decay reads as "message"
 * without shipping an audio asset or paying for a network request.
 */
let context: AudioContext | undefined;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

export function playChime(kind: 'incoming' | 'outgoing' | 'mention' = 'incoming') {
  const ctx = getContext();
  if (!ctx) return;

  // Browsers suspend the context until a user gesture has happened.
  if (ctx.state === 'suspended') void ctx.resume();

  const notes =
    kind === 'mention' ? [880, 1174.7] : kind === 'outgoing' ? [660, 880] : [523.25, 783.99];
  const now = ctx.currentTime;

  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    const start = now + index * 0.075;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(kind === 'outgoing' ? 0.05 : 0.12, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.3);
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function showDesktopNotification(options: {
  title: string;
  body?: string | null;
  icon?: string | null;
  tag?: string;
  onClick?: () => void;
}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // Don't shout at a focused tab.

  const notification = new Notification(options.title, {
    body: options.body ?? undefined,
    icon: options.icon ?? undefined,
    tag: options.tag,
    silent: true, // We play our own chime.
  });

  notification.onclick = () => {
    window.focus();
    options.onClick?.();
    notification.close();
  };
}
