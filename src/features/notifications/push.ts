'use client';

import { api } from '@/lib/api-client';

/**
 * Browser side of web push: register the worker, ask once, hand the
 * subscription to the server.
 *
 * Separate from `sound.ts`, which drives the in-page Notification API. That one
 * only fires while the tab is alive; this one is what reaches a closed app.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

/**
 * On iOS this is only true once the app has been added to the home screen.
 * Safari exposes no push in a normal tab, so the honest thing is to tell the
 * user to install rather than show a button that can never work.
 */
export function needsInstallFirst(): boolean {
  if (typeof window === 'undefined') return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  return isIOS && !standalone;
}

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 *
 * Backed by an explicit ArrayBuffer because `applicationServerKey` will not
 * accept a view that might sit on a SharedArrayBuffer.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normalised = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function describeDevice(): string {
  const agent = navigator.userAgent;
  const browser =
    /Edg\//.test(agent) ? 'Edge'
    : /Chrome\//.test(agent) ? 'Chrome'
    : /Firefox\//.test(agent) ? 'Firefox'
    : /Safari\//.test(agent) ? 'Safari'
    : 'Browser';
  const platform =
    /Android/.test(agent) ? 'Android'
    : /iPad|iPhone|iPod/.test(agent) ? 'iOS'
    : /Mac/.test(agent) ? 'macOS'
    : /Win/.test(agent) ? 'Windows'
    : 'this device';
  return `${browser} on ${platform}`;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (error) {
    console.error('[push] service worker registration failed', error);
    return null;
  }
}

export type PushEnableResult = 'enabled' | 'denied' | 'unsupported' | 'needs-install' | 'error';

/** Asks for permission and registers this device. Safe to call twice. */
export async function enablePush(): Promise<PushEnableResult> {
  if (!pushSupported()) return 'unsupported';
  if (needsInstallFirst()) return 'needs-install';

  try {
    const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
    if (!registration) return 'error';

    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'denied';
    }

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // Required by every browser: a push must be visible to the user.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      }));

    const raw = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys.auth) return 'error';

    await api('/push/subscriptions', {
      method: 'POST',
      body: {
        endpoint: raw.endpoint,
        keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
        label: describeDevice(),
      },
    });

    return 'enabled';
  } catch (error) {
    console.error('[push] could not enable', error);
    return 'error';
  }
}

/** Unregisters this device, both in the browser and on the server. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await api('/push/subscriptions', { method: 'DELETE', body: { endpoint } });
  } catch (error) {
    console.error('[push] could not disable', error);
  }
}

export async function pushIsEnabledHere(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
}
