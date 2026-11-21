/**
 * OneSignal Web Push (viewer broadcasts).
 *
 * Enabled purely by configuration — nothing to change when unset:
 *   VITE_ONESIGNAL_APP_ID  (build-time, exposed to the browser)
 *   public/OneSignalSDKWorker.js must be served at the site root (it is).
 * Server side uses ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    OneSignal?: any;
  }
}

let sdkPromise: Promise<any> | null = null;

export function oneSignalAppId(): string {
  return String(import.meta.env.VITE_ONESIGNAL_APP_ID ?? '').trim();
}

/** Loads the OneSignal Web SDK from their CDN. Resolves null when unset. */
export async function loadOneSignal(): Promise<any | null> {
  if (!oneSignalAppId() || typeof window === 'undefined') return null;
  if (window.OneSignal) return window.OneSignal;
  sdkPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = () => resolve(window.OneSignal);
    script.onerror = () => reject(new Error('OneSignal SDK failed to load'));
    document.head.appendChild(script);
  });
  return sdkPromise.catch((err) => {
    console.warn('[onesignal]', (err as Error).message);
    return null;
  });
}

let inited = false;

/** Initialises push on the site and schedules the opt-in slidedown. */
export async function initOneSignal(): Promise<void> {
  const appId = oneSignalAppId();
  if (!appId || inited) return;
  const OneSignal = await loadOneSignal();
  if (!OneSignal) return;
  inited = true;
  try {
    await OneSignal.init({
      appId,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      serviceWorkerUpdaterPath: '/OneSignalSDKWorker.js',
      allowLocalhostAsSecureOrigin: import.meta.env.DEV,
    });
    // Give new visitors a moment on the site before asking to subscribe.
    window.setTimeout(() => {
      void promptOneSignalPush();
    }, 12_000);
  } catch (err) {
    console.warn('[onesignal] init failed:', (err as Error).message);
  }
}

/** Shows the opt-in slidedown when the visitor is not subscribed yet. */
export async function promptOneSignalPush(): Promise<void> {
  const OneSignal = await loadOneSignal();
  if (!OneSignal?.Slidedown) return;
  try {
    if (!OneSignal.User.PushSubscription.optedIn) {
      await OneSignal.Slidedown.promptPush();
    }
  } catch {
    /* prompt unavailable (e.g. already dismissed, or permission denied) */
  }
}
