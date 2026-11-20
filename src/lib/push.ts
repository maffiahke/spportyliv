import {
  fetchPushConfig,
  subscribePush,
  unsubscribePush,
  PushConfig,
} from './api';

/**
 * Browser-side admin web push helpers.
 *
 * Requires a secure context: https, or http on localhost/127.0.0.1.
 * iOS Safari additionally requires the site be installed to the home screen.
 */

export type PushSupport = 'supported' | 'insecure' | 'unsupported';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const secure = window.isSecureContext;
  const hasApi =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!hasApi) return 'unsupported';
  if (!secure) return 'insecure';
  return 'supported';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerAdminServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/admin-sw.js', { scope: '/' });
  } catch (err) {
    console.warn('[push] service worker registration failed', err);
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerAdminServiceWorker();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export type EnableResult =
  | { status: 'subscribed'; subscriptions: number }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string };

/** Requests notification permission, creates the push subscription and stores it server-side. */
export async function enableAdminPush(config?: PushConfig): Promise<EnableResult> {
  const support = pushSupport();
  if (support !== 'supported') {
    return {
      status: 'unsupported',
      reason:
        support === 'insecure'
          ? 'Web push needs HTTPS (or localhost). Open the admin over https to enable it.'
          : 'This browser does not support service workers or push messages.',
    };
  }

  const cfg = config ?? (await fetchPushConfig());
  if (!cfg.publicKey) {
    return { status: 'unsupported', reason: 'Server VAPID key is missing — restart the server.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { status: 'denied' };

  const reg = await registerAdminServiceWorker();
  if (!reg) return { status: 'unsupported', reason: 'Service worker registration failed.' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    // Some browsers/headless profiles expose PushManager but never resolve
    // subscribe() when no push service is available — fail with a clear message.
    sub = await Promise.race([
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                'The browser did not provide a push service (this can happen in headless or restricted profiles).',
              ),
            ),
          15_000,
        ),
      ),
    ]);
  }

  const { subscriptions } = await subscribePush(sub.toJSON() as PushSubscriptionJSON);
  return { status: 'subscribed', subscriptions };
}

/** Removes the browser subscription and deletes it from the server. */
export async function disableAdminPush(): Promise<number> {
  const reg = await registerAdminServiceWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    try {
      await unsubscribePush(sub.endpoint);
    } catch {
      /* server may already have pruned it */
    }
    await sub.unsubscribe();
  }
  const cfg = await fetchPushConfig().catch(() => null);
  return cfg?.subscriptions ?? 0;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
