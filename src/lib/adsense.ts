/**
 * AdSense loader: exactly one script tag, injected after first paint, with a
 * consent gate and a push helper that is safe under React StrictMode and
 * realtime re-renders.
 */

const SCRIPT_ID = 'sportylive-adsbygoogle';
const CONSENT_KEY = 'sportylive_ads_consent';

const consentListeners = new Set<(granted: boolean) => void>();

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    __sportyliveAdsConsent?: boolean;
  }
}

/** Consent signal (CMP or a manual choice) — required in EEA/UK. */
export function adsConsentGranted(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.__sportyliveAdsConsent === true) return true;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function setAdsConsent(granted: boolean): void {
  if (typeof window === 'undefined') return;
  window.__sportyliveAdsConsent = granted;
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    /* private mode — the in-memory flag still applies */
  }
  // Mounted units keep their placeholder until consent arrives; let them retry.
  consentListeners.forEach((listener) => listener(granted));
}

/** The viewer's stored choice, or null when they have not answered yet. */
export function adsConsentChoice(): boolean | null {
  if (typeof window === 'undefined') return null;
  if (window.__sportyliveAdsConsent === true) return true;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored === 'granted') return true;
    if (stored === 'denied') return false;
  } catch {
    /* private mode */
  }
  return null;
}

/** Subscribe to consent changes so a freshly accepted choice fills the slots. */
export function subscribeAdsConsent(listener: (granted: boolean) => void): () => void {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

let loader: Promise<boolean> | null = null;
let loadedClient = '';

function whenIdle(callback: () => void): void {
  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof idle === 'function') idle(callback, { timeout: 2000 });
  else window.setTimeout(callback, 300);
}

/**
 * Load the AdSense script once. Resolves false when consent is missing or the
 * script cannot load, so callers can keep the placeholder instead of crashing.
 */
export function preloadAdsense(client: string, consentRequired = true): Promise<boolean> {
  if (typeof window === 'undefined' || !client) return Promise.resolve(false);
  if (consentRequired && !adsConsentGranted()) return Promise.resolve(false);
  if (loader && loadedClient === client) return loader;

  loadedClient = client;
  loader = new Promise<boolean>((resolve) => {
    const start = () => {
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (existing) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn('[ads] AdSense script failed to load (blocked or offline)');
        // Allow a later mount to retry instead of caching the failure forever.
        loader = null;
        loadedClient = '';
        script.remove();
        resolve(false);
      };
      document.head.appendChild(script);
    };
    whenIdle(start);
  });
  return loader;
}

/**
 * Fill one `<ins class="adsbygoogle">`. Never pushes the same element twice —
 * a second push is what produces "All ins elements … already have ads".
 */
export async function fillAdSlot(element: HTMLElement, client: string, consentRequired = true): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (element.dataset.sportyAdFilled === '1') return false;
  const ready = await preloadAdsense(client, consentRequired);
  if (!ready) return false;
  if (element.dataset.sportyAdFilled === '1') return false;
  try {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
    element.dataset.sportyAdFilled = '1';
    return true;
  } catch (err) {
    console.warn('[ads] push failed:', (err as Error).message);
    return false;
  }
}

/** Test hook: forget the loader so a fresh script tag can be created. */
export function resetAdsenseLoader(): void {
  loader = null;
  loadedClient = '';
  document.getElementById(SCRIPT_ID)?.remove();
}
