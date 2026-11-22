/**
 * Alternative ad-network loader (Monetag + Adsterra) — the AdSense
 * counterparts in `adsense.ts`:
 *
 *  - `preloadAltNetworkScript` injects exactly one site-wide script tag per
 *    network (Monetag MultiTag / Adsterra Social Bar), consent-gated.
 *  - `injectAdCode` mounts a pasted zone snippet (banner / native / etc.)
 *    into a slot container. Pasted snippets carry their own <script> tags,
 *    which innerHTML does not execute — every script node is recreated so
 *    the browser actually runs it, exactly once per container.
 *
 * Both are gated by the same consent signal as AdSense.
 */
import { adsConsentGranted } from './adsense';
import type { AdNetworkKind } from '../types/iptv';

const SCRIPT_IDS: Record<AdNetworkKind, string> = {
  monetag: 'sportylive-monetag',
  adsterra: 'sportylive-adsterra',
};

const altLoaders = new Map<AdNetworkKind, Promise<boolean>>();
const altLoadedUrls = new Map<AdNetworkKind, string>();

function whenIdle(callback: () => void): void {
  const idle = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof idle === 'function') idle(callback, { timeout: 2000 });
  else window.setTimeout(callback, 300);
}

/**
 * Load a network's site-wide script once. Resolves false when consent is
 * missing or the script cannot load; a later call may retry.
 */
export function preloadAltNetworkScript(
  kind: AdNetworkKind,
  url: string,
  consentRequired = true,
): Promise<boolean> {
  if (typeof window === 'undefined' || !url) return Promise.resolve(false);
  if (consentRequired && !adsConsentGranted()) return Promise.resolve(false);
  const pending = altLoaders.get(kind);
  if (pending && altLoadedUrls.get(kind) === url) return pending;

  altLoadedUrls.set(kind, url);
  const loader = new Promise<boolean>((resolve) => {
    const start = () => {
      const existing = document.getElementById(SCRIPT_IDS[kind]) as HTMLScriptElement | null;
      if (existing && existing.src === url) {
        resolve(true);
        return;
      }
      existing?.remove();
      const script = document.createElement('script');
      script.id = SCRIPT_IDS[kind];
      script.async = true;
      script.dataset.cfasync = 'false';
      script.src = url;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.warn(`[ads] ${kind} script failed to load (blocked or offline)`);
        altLoaders.delete(kind);
        altLoadedUrls.delete(kind);
        script.remove();
        resolve(false);
      };
      document.head.appendChild(script);
    };
    whenIdle(start);
  });
  altLoaders.set(kind, loader);
  return loader;
}

/**
 * Mount a pasted network zone snippet into one slot container. Safe to call
 * on every render: the container remembers it was filled, and scripts are
 * recreated (never moved) so re-mounts execute a fresh copy.
 */
export function injectAdCode(container: HTMLElement, code: string): void {
  if (container.dataset.sportyAltFilled === code) return;
  container.dataset.sportyAltFilled = code;
  container.innerHTML = '';

  const template = document.createElement('template');
  template.innerHTML = code;
  const recreate = (node: Node): Node | null => {
    if (!(node instanceof HTMLElement)) {
      return node.cloneNode(true);
    }
    if (node instanceof HTMLScriptElement) {
      const script = document.createElement('script');
      for (const attr of Array.from(node.attributes)) script.setAttribute(attr.name, attr.value);
      script.text = node.text;
      return script;
    }
    const clone = node.cloneNode(false) as HTMLElement;
    for (const child of Array.from(node.childNodes)) {
      const next = recreate(child);
      if (next) clone.appendChild(next);
    }
    return clone;
  };
  for (const child of Array.from(template.content.childNodes)) {
    const next = recreate(child);
    if (next) container.appendChild(next);
  }
}

/** Test hook: forget the site-wide loaders so fresh script tags can be made. */
export function resetAltNetworkLoaders(): void {
  altLoaders.clear();
  altLoadedUrls.clear();
  for (const id of Object.values(SCRIPT_IDS)) document.getElementById(id)?.remove();
}
