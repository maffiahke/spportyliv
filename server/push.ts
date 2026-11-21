import {
  generateVAPIDKeys,
  sendNotification,
  setVapidDetails,
} from 'web-push';
import { loadStore, makeId, saveStore, PushPrefs } from './store.js';

/**
 * Admin web-push delivery.
 *
 * VAPID keys are generated once and persisted in the JSON store so browser
 * subscriptions stay valid across dev-server restarts. Notifications are sent
 * to every subscribed admin browser and stale endpoints (404/410) are pruned.
 */

let configuredPublicKey = '';

function ensureVapid(): { publicKey: string; privateKey: string } {
  const store = loadStore();
  if (!store.vapid?.publicKey || !store.vapid.privateKey) {
    const keys = generateVAPIDKeys();
    store.vapid = keys;
    saveStore();
    console.log('[push] generated new VAPID key pair');
  }
  const { publicKey, privateKey } = store.vapid;
  if (configuredPublicKey !== publicKey) {
    const contact = store.settings.supportEmail
      ? `mailto:${store.settings.supportEmail}`
      : 'mailto:admin@sportylive.local';
    setVapidDetails(contact, publicKey, privateKey);
    configuredPublicKey = publicKey;
  }
  return store.vapid;
}

export function getVapidPublicKey(): string {
  return ensureVapid().publicKey;
}

export function getPushPrefs(): PushPrefs {
  return loadStore().pushPrefs;
}

export function getSubscriptionCount(): number {
  return loadStore().pushSubscriptions.length;
}

export function savePushPrefs(patch: Partial<PushPrefs>): PushPrefs {
  const store = loadStore();
  const next: PushPrefs = { ...store.pushPrefs };
  for (const key of ['newEvents', 'syncErrors', 'syncChanges'] as const) {
    if (typeof patch[key] === 'boolean') next[key] = patch[key] as boolean;
  }
  store.pushPrefs = next;
  saveStore();
  return next;
}

export interface IncomingSubscription {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export function addSubscription(
  sub: IncomingSubscription,
  userAgent?: string,
): { ok: boolean; count: number; error?: string } {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return { ok: false, count: getSubscriptionCount(), error: 'Invalid push subscription' };
  }
  const store = loadStore();
  const existing = store.pushSubscriptions.find((s) => s.endpoint === sub.endpoint);
  if (existing) {
    existing.keys = { p256dh: sub.keys.p256dh, auth: sub.keys.auth };
    existing.userAgent = userAgent ?? existing.userAgent;
  } else {
    store.pushSubscriptions.push({
      id: makeId('push'),
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      createdAt: new Date().toISOString(),
      userAgent,
    });
  }
  saveStore();
  return { ok: true, count: store.pushSubscriptions.length };
}

export function removeSubscription(endpoint: string): number {
  const store = loadStore();
  const before = store.pushSubscriptions.length;
  store.pushSubscriptions = store.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
  if (store.pushSubscriptions.length !== before) saveStore();
  return store.pushSubscriptions.length;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** Notification accent, mapped to an icon by the service worker. */
  kind?: 'event' | 'sync' | 'error' | 'test';
}

export interface PushResult {
  sent: number;
  failed: number;
  removed: number;
  configured: boolean;
}

/** Sends a payload to every subscribed admin device. Never throws. */
export async function sendPush(payload: PushPayload): Promise<PushResult> {
  const store = loadStore();
  if (store.pushSubscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0, configured: false };
  }
  try {
    ensureVapid();
  } catch (err) {
    console.error('[push] failed to configure VAPID:', (err as Error).message);
    return { sent: 0, failed: store.pushSubscriptions.length, removed: 0, configured: false };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/admin',
    tag: payload.tag,
    kind: payload.kind ?? 'event',
  });

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  await Promise.all(
    store.pushSubscriptions.map(async (rec) => {
      try {
        await sendNotification(
          { endpoint: rec.endpoint, keys: rec.keys },
          body,
          { TTL: 60 * 60 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(rec.endpoint);
        failed++;
        console.warn(`[push] delivery failed (${status ?? 'network'})`, (err as Error).message);
      }
    }),
  );

  if (stale.length > 0) {
    const s = loadStore();
    s.pushSubscriptions = s.pushSubscriptions.filter((x) => !stale.includes(x.endpoint));
    saveStore();
    console.log(`[push] pruned ${stale.length} expired subscription(s)`);
  }

  return { sent, failed, removed: stale.length, configured: true };
}

/* ───────── OneSignal (viewer broadcasts, optional) ───────── */

export interface OneSignalResult {
  ok: boolean;
  /** True when ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY are set. */
  configured: boolean;
  detail?: string;
}

/**
 * Broadcasts a notification to every subscribed viewer via the OneSignal
 * REST API (v11). Used for viewer-facing alerts — admin ops alerts (sync
 * status, errors) stay on the VAPID channel above so they never spam
 * viewers.
 */
export async function sendOneSignalPush(payload: PushPayload): Promise<OneSignalResult> {
  const appId = (process.env.ONESIGNAL_APP_ID ?? '').trim();
  const apiKey = (process.env.ONESIGNAL_REST_API_KEY ?? '').trim();
  if (!appId || !apiKey) return { ok: false, configured: false };
  try {
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ['Subscribed Users'],
        headings: { en: payload.title },
        contents: { en: payload.body },
        url: payload.url ?? '/',
        ...(payload.tag ? { external_id: payload.tag } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      errors?: Record<string, unknown>;
    };
    if (!res.ok) {
      console.error('[onesignal] send rejected:', res.status, JSON.stringify(json).slice(0, 300));
      return { ok: false, configured: true, detail: `HTTP ${res.status}` };
    }
    if (json.errors) {
      console.error('[onesignal] send errors:', JSON.stringify(json.errors).slice(0, 300));
      return { ok: false, configured: true, detail: 'errors in response' };
    }
    return { ok: true, configured: true, detail: json.id };
  } catch (err) {
    console.error('[onesignal] send failed:', (err as Error).message);
    return { ok: false, configured: true, detail: (err as Error).message };
  }
}

/* ───────────── Event-driven notifications (respect admin prefs) ───────────── */

export interface EventAlertResult {
  ok: boolean;
  vapid: PushResult;
  onesignal: OneSignalResult;
}

/**
 * Manual alert pushed from the admin Events tab: fans out to admin devices
 * (VAPID) and to all subscribed viewers (OneSegment broadcast). The push
 * deep-links to the event via /?watch=<id>.
 */
export async function sendEventAlert(
  event: { id: string; homeTeam: string; awayTeam: string },
  title: string,
  body: string,
): Promise<EventAlertResult> {
  const payload: PushPayload = {
    title,
    body,
    url: `/?watch=${encodeURIComponent(event.id)}`,
    tag: `event-${event.id}`,
    kind: 'event',
  };
  const emptyVapid: PushResult = { sent: 0, failed: 0, removed: 0, configured: false };
  const [vapid, onesignal] = await Promise.all([
    sendPush(payload).catch(() => emptyVapid),
    sendOneSignalPush(payload).catch(() => ({ ok: false, configured: false }) as OneSignalResult),
  ]);
  return { ok: vapid.sent > 0 || onesignal.ok, vapid, onesignal };
}

export function notifyNewEvent(kind: 'live' | 'upcoming', home: string, away: string, league: string) {
  const prefs = getPushPrefs();
  const names = `${home} vs ${away}`;
  const payload = {
    title: kind === 'live' ? `LIVE NOW — ${names}` : `Starting soon — ${names}`,
    body: `${league ? `${league} — ` : ''}${
      kind === 'live' ? 'Match is underway — watch it live on SportyLive.' : 'Kickoff soon — watch on SportyLive.'
    }`,
    tag: `event-${home}-${away}`.toLowerCase().replace(/\s+/g, '-'),
    kind: 'event' as const,
  };
  if (prefs.newEvents) {
    void sendPush(payload).catch(() => {});
  }
  // Viewer broadcast through OneSignal when configured.
  void sendOneSignalPush(payload).catch(() => {});
}

export function notifySyncError(playlistName: string, message: string) {
  const prefs = getPushPrefs();
  if (!prefs.syncErrors) return;
  void sendPush({
    title: `Playlist sync failed — ${playlistName}`,
    body: message.slice(0, 180),
    tag: `sync-error-${playlistName}`.toLowerCase().replace(/\s+/g, '-'),
    kind: 'error',
  }).catch(() => {});
}

export function notifySyncChanges(playlistName: string, added: number, removed: number) {
  const prefs = getPushPrefs();
  if (!prefs.syncChanges) return;
  if (added === 0 && removed === 0) return;
  void sendPush({
    title: `Playlist updated — ${playlistName}`,
    body: `+${added} channel${added === 1 ? '' : 's'} added, ${removed} removed`,
    tag: `sync-${playlistName}`.toLowerCase().replace(/\s+/g, '-'),
    kind: 'sync',
  }).catch(() => {});
}
