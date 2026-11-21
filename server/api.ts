import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual as nodeTimingSafeEqual,
} from 'crypto';
import { findCountry } from '../src/data/countries.js';
import type { AppUser } from '../src/types/user.js';
import { Readable } from 'stream';
import { guessSport, parseM3U, shortCode } from '../src/lib/m3u.js';
import {
  AD_PLACEMENT_IDS,
  AdminBanner,
  AdminLiveEvent,
  AdminUpcomingEvent,
  AdsSettings,
  DEFAULT_ADS_SETTINGS,
  IptvChannel,
  IptvPlaylist,
  StreamHeaders,
} from '../src/types/iptv.js';
import {
  ensureStoreReady,
  getAppData,
  getStoreRevision,
  isServerlessRuntime,
  loadStore,
  makeId,
  onStoreChange,
  recordVisitorPing,
  saveStore,
  storeBackend,
  syncFromDatabase,
  visitorAnalyticsSummary,
  type StoredUser,
  type StoreData,
  type UserSessionRecord,
} from './store.js';
import {
  detectMatchFormat,
  importMatchesIntoStore,
  parseMatchesFromJson,
  parseMatchesFromM3U,
} from './matchImport.js';
import {
  addSubscription,
  getPushPrefs,
  getSubscriptionCount,
  getVapidPublicKey,
  notifyNewEvent,
  notifySyncChanges,
  notifySyncError,
  removeSubscription,
  savePushPrefs,
  sendEventAlert,
  sendOneSignalPush,
  sendPush,
} from './push.js';

const PROXY_HOPS = 6;
const PROXY_TIMEOUT_MS = 20_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function b64urlDecode(input: string): string {
  try {
    return Buffer.from(input, 'base64url').toString('utf-8');
  } catch {
    return '';
  }
}

function decodeQueryValue(input: string): string {
  return b64urlDecode(input) || decodeURIComponent(input.replace(/\+/g, '%20'));
}

/** Build upstream request headers from the stored StreamHeaders + forwarding. */
function buildUpstreamHeaders(headers: StreamHeaders, forward: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {
    'user-agent': headers.userAgent || 'VLC/3.0.20 LibVLC/3.0.20',
    accept: '*/*',
    // Keep the upstream connection alive: undici reuses it for the playlist
    // ping + segment fetches, saving a TCP+TLS handshake per segment (~0.4s
    // on slow origins). Forcing `close` here was a measurable buffer stall.
    connection: 'keep-alive',
  };
  if (headers.referer) out.referer = headers.referer;
  if (headers.origin) out.origin = headers.origin;
  if (headers.cookies) out.cookie = headers.cookies;
  if (headers.extra) {
    for (const [k, v] of Object.entries(headers.extra)) out[k.toLowerCase()] = v;
  }
  // Forward browser headers that matter for range playback
  const range = forward.get('range');
  if (range) out.range = range;
  return out;
}

/* ------------------------------------------------------------------ */
/* Playlist import / parsing                                           */
/* ------------------------------------------------------------------ */

async function fetchPlaylistText(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl, {
    headers: { 'user-agent': 'SportyLive/1.0 (playlist importer)' },
    signal: AbortSignal.timeout(30_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} while fetching playlist`);
  return res.text();
}

/**
 * Smart sync: re-fetch the playlist and diff channels by stream URL.
 * - New URLs are added.
 * - Existing URLs keep their channel id and admin tweaks (enabled, shelf,
 *   quality, edited name/headers) while refreshing provider metadata.
 * - URLs that disappeared from the playlist (dead/gone) are removed.
 */
/** Normalise admin-provided extra streams; null when the field is absent. */
function parseCustomStreams(raw: unknown): Array<{ url: string; title?: string; userAgent?: string; referer?: string }> | null {
  if (!Array.isArray(raw)) return null;
  const streams: Array<{ url: string; title?: string; userAgent?: string; referer?: string }> = [];
  for (const item of raw as unknown[]) {
    const s = (item ?? {}) as Record<string, unknown>;
    const url = typeof s.url === 'string' ? s.url.trim() : '';
    if (!url) continue;
    const out: { url: string; title?: string; userAgent?: string; referer?: string } = { url };
    if (typeof s.title === 'string' && s.title.trim()) out.title = s.title.trim();
    if (typeof s.userAgent === 'string' && s.userAgent.trim()) out.userAgent = s.userAgent.trim();
    if (typeof s.referer === 'string' && s.referer.trim()) out.referer = s.referer.trim();
    streams.push(out);
  }
  return streams;
}

async function syncPlaylistChannels(
  playlist: IptvPlaylist,
  opts: { testChannels?: boolean } = {},
): Promise<{ added: number; updated: number; removed: number; tested?: number; alive?: number; dead?: number; deleted?: number }> {
  const text = playlist.sourceUrl
    ? await fetchPlaylistText(playlist.sourceUrl)
    : playlist.sourceContent ?? '';
  const fresh = channelsFromText(playlist.id, playlist.name, text);

  const store = loadStore();
  // Heal any historical duplicate ids for this playlist: the refresh below
  // reuses provider positions, so a store already holding colliding ids would
  // otherwise keep producing duplicate React keys downstream.
  const existingById = new Map<string, IptvChannel>();
  for (const c of store.channels as IptvChannel[]) {
    if (c.playlistId !== playlist.id || existingById.has(c.id)) continue;
    existingById.set(c.id, c);
  }
  const existing = [...existingById.values()];
  const usedIds = new Set(existingById.keys());
  const freshByUrl = new Map(fresh.map((c) => [c.url, c]));
  const existingByUrl = new Set(existing.map((c) => c.url));

  let added = 0;
  let kept = 0;
  const keptChannels: IptvChannel[] = [];
  for (const ch of existing) {
    const f = freshByUrl.get(ch.url);
    if (!f) continue; // gone from provider — dropped
    ch.name = f.name || ch.name;
    ch.group = f.group;
    ch.tvgId = f.tvgId;
    ch.tvgLogo = f.tvgLogo || ch.tvgLogo;
    ch.sport = f.sport;
    if (f.headers && Object.keys(f.headers).length > 0) ch.headers = f.headers;
    keptChannels.push(ch);
    kept++;
  }
  for (const f of fresh) {
    if (!existingByUrl.has(f.url)) {
      // Fresh ids are `${playlistId}-${index}`; an index can collide with an id
      // kept from an older import when the provider reorders/removes entries.
      const id = uniqueChannelId(f.id, usedIds);
      usedIds.add(id);
      keptChannels.push({ ...f, id });
      added++;
    }
  }

  const removed = existing.length - kept;
  store.channels = store.channels.filter((c: IptvChannel) => c.playlistId !== playlist.id).concat(keptChannels);
  playlist.channelCount = keptChannels.length;
  playlist.lastSyncedAt = new Date().toISOString();
  playlist.lastError = undefined;
  await saveStore();
  // After every sync, probe every channel in the store: only HTTP 200 streams
  // are kept — the rest are deleted automatically (see testAllChannels).
  const health = opts.testChannels === false
    ? undefined
    : await testAllChannels();
  return { added, updated: kept, removed, ...health };
}

/* ---------------- Channel health probing ----------------
 * A channel is "alive" only when its stream URL answers HTTP 200. The probe
 * follows redirects, cancels the body as soon as headers arrive (so video is
 * never downloaded) and is capped by a global time budget so a large
 * playlist cannot exceed a serverless invocation window.
 */

const PROBE_TIMEOUT_MS = 8_000;
const PROBE_CONCURRENCY = 8;
const PROBE_TOTAL_BUDGET_MS = 40_000;

async function probeChannel(channel: IptvChannel): Promise<boolean> {
  try {
    const res = await fetch(channel.url, {
      headers: buildUpstreamHeaders(channel.headers ?? {}, new URLSearchParams()),
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const ok = res.status === 200;
    await res.body?.cancel();
    return ok;
  } catch {
    return false;
  }
}

/** Probe every channel in the store; dead ones are deleted automatically. */
async function testAllChannels(
  budgetMs = PROBE_TOTAL_BUDGET_MS,
): Promise<{ tested: number; alive: number; dead: number; deleted: number }> {
  const store = loadStore();
  const channels = store.channels as IptvChannel[];
  if (channels.length === 0) return { tested: 0, alive: 0, dead: 0, deleted: 0 };

  const deadline = Date.now() + budgetMs;
  let index = 0;
  let tested = 0;
  let alive = 0;
  let dead = 0;

  const runNext = async (): Promise<void> => {
    while (index < channels.length && Date.now() <= deadline) {
      const ch = channels[index++];
      const ok = await probeChannel(ch);
      ch.alive = ok;
      ch.checkedAt = new Date().toISOString();
      tested++;
      if (ok) alive++;
      else dead++;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, channels.length) }, () => runNext()),
  );

  // Auto-delete every channel whose probe failed: only HTTP 200 streams are
  // worth keeping. Channels the budget left untested keep their previous state
  // and are re-probed on the next sync.
  const removedIds = new Set(
    (store.channels as IptvChannel[]).filter((c) => c.alive === false).map((c) => c.id),
  );
  if (removedIds.size > 0) {
    store.channels = (store.channels as IptvChannel[]).filter(
      (c) => !removedIds.has(c.id),
    );
    for (const p of store.playlists) {
      const count = (store.channels as IptvChannel[]).filter(
        (c) => c.playlistId === p.id,
      ).length;
      if (p.channelCount !== count) p.channelCount = count;
    }
  }
  if (tested > 0 || removedIds.size > 0) await saveStore();
  console.log(
    `[health-check] tested ${tested}/${channels.length}: ${alive} alive, ${dead} dead, ${removedIds.size} deleted`,
  );
  return { tested, alive, dead, deleted: removedIds.size };
}

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

/** Every 5 minutes, re-sync every playlist with autoSync enabled. */
export function startAutoSync(intervalMs = 10 * 60 * 1000): void {
  if (autoSyncTimer) return;
  autoSyncTimer = setInterval(() => {
    // The interval callback must never surface an unhandled rejection — a
    // failed save here used to crash the whole process.
    void runAutoSync().catch((err) =>
      console.error('[auto-sync] run failed:', (err as Error).message),
    );
  }, intervalMs);
  console.log(`[auto-sync] scheduler running every ${Math.round(intervalMs / 60000)} min`);
}

export async function runAutoSync(): Promise<{ tested: number; alive: number; dead: number; deleted: number }> {
  // The store may still be loading on a cold start; the next tick picks it up.
  await ensureStoreReady();
  const store = loadStore();
  const due = store.playlists.filter((p: IptvPlaylist) => p.autoSync && p.enabled !== false);
  if (due.length === 0) return { tested: 0, alive: 0, dead: 0, deleted: 0 };
  await Promise.all(
    due.map(async (p: IptvPlaylist) => {
      try {
        const stats = await syncPlaylistChannels(p, { testChannels: false });
        console.log(`[auto-sync] ${p.name}: +${stats.added} added, ${stats.removed} removed`);
        notifySyncChanges(p.name, stats.added, stats.removed);
      } catch (err) {
        p.lastError = (err as Error).message;
        await saveStore();
        console.error(`[auto-sync] ${p.name} failed:`, (err as Error).message);
        notifySyncError(p.name, (err as Error).message);
      }
    }),
  );
  // One full health pass for all channels after the sync batch, not per playlist.
  const health = await testAllChannels();
  return health;
}

export interface ImportResult {
  playlist: IptvPlaylist;
  channelCount: number;
  sample: string[];
  error?: string;
}

function channelsFromText(
  playlistId: string,
  playlistName: string,
  text: string
): IptvChannel[] {
  const parsed = parseM3U(text);
  const seen = new Set<string>();
  const out: IptvChannel[] = [];
  parsed.forEach((p, i) => {
    if (seen.has(p.url)) return;
    seen.add(p.url);
    out.push({
      id: `${playlistId}-${i}`,
      playlistId,
      name: p.name || `${playlistName} ${i + 1}`,
      group: p.group,
      tvgId: p.tvgId,
      tvgLogo: p.tvgLogo,
      url: p.url,
      headers: p.headers,
      sport: guessSport(p.name, p.group) as IptvChannel['sport'],
      shelf: 'recent',
      quality: 'HD',
      enabled: true,
    });
  });
  return out;
}

function shortCodeOfName(name: string): string {
  return shortCode(name);
}

/** First free `${base}`, `${base}-2`, `${base}-3` … against a set of live ids. */
function uniqueChannelId(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Merge a partial AdSense patch into the stored settings. Placement ids are
 * whitelisted so an admin payload can never invent a placement the renderer
 * would not understand.
 */
function normalizeAdsSettings(
  patch: Partial<AdsSettings>,
  current?: AdsSettings,
): AdsSettings {
  const base: AdsSettings = current ?? DEFAULT_ADS_SETTINGS;
  const slots: AdsSettings['slots'] = { ...DEFAULT_ADS_SETTINGS.slots, ...base.slots };

  if (patch.slots && typeof patch.slots === 'object' && !Array.isArray(patch.slots)) {
    for (const id of AD_PLACEMENT_IDS) {
      const raw = (patch.slots as Record<string, unknown>)[id];
      if (!raw || typeof raw !== 'object') continue;
      const entry = raw as { enabled?: unknown; slotId?: unknown };
      slots[id] = {
        enabled: Boolean(entry.enabled),
        slotId: typeof entry.slotId === 'string' ? entry.slotId.trim() : '',
      };
    }
  }

  const maxPerPage = Number(patch.maxPerPage);
  return {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : base.enabled,
    publisherId:
      typeof patch.publisherId === 'string' ? patch.publisherId.trim() : base.publisherId,
    maxPerPage: Number.isFinite(maxPerPage)
      ? Math.min(6, Math.max(0, Math.round(maxPerPage)))
      : base.maxPerPage,
    consentRequired:
      typeof patch.consentRequired === 'boolean'
        ? patch.consentRequired
        : base.consentRequired,
    slots,
  };
}

export { shortCodeOfName };

/* ------------------------------------------------------------------ */
/* Stream proxy with header injection + m3u8 rewriting                 */
/* ------------------------------------------------------------------ */

function isPlaylistMime(contentType: string | null, url: string): boolean {
  if (contentType && /mpegurl|x-mpegurl|vnd\.apple/i.test(contentType)) return true;
  return /\.m3u8(\?|$)/i.test(url);
}

function rewriteM3U8(text: string, baseUrl: string, headers: StreamHeaders, proxyBase: string): string {
  const proxyFor = (target: string): string => {
    const abs = new URL(target, baseUrl).href;
    const u = Buffer.from(abs, 'utf-8').toString('base64url');
    const h = Buffer.from(JSON.stringify(headers ?? {}), 'utf-8').toString('base64url');
    return `${proxyBase}?u=${u}&h=${h}`;
  };

  const outLines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      outLines.push('');
      continue;
    }
    if (line.startsWith('#')) {
      // Rewrite quoted URIs inside directives (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA, SESSION-DATA...)
      outLines.push(
        line.replace(/URI="([^"]+)"/g, (_m, uri: string) => `URI="${proxyFor(uri)}"`)
      );
      continue;
    }
    outLines.push(proxyFor(line));
  }
  return outLines.join('\n');
}

async function handleStreamProxy(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  query: URLSearchParams,
  proxyBase: string
): Promise<void> {
  const targetUrl = decodeQueryValue(query.get('u') ?? '');
  let headers: StreamHeaders = {};
  try {
    headers = JSON.parse(decodeQueryValue(query.get('h') ?? '{}'));
  } catch {
    headers = {};
  }
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid or missing stream URL' }));
    return;
  }

  const forward = new URLSearchParams();
  const reqRange = req.headers.range;
  if (reqRange) forward.set('range', reqRange);

  let currentUrl = targetUrl;
  let upstream: Response | null = null;

  try {
    for (let hop = 0; hop < PROXY_HOPS; hop++) {
      upstream = await fetch(currentUrl, {
        headers: buildUpstreamHeaders(headers, forward),
        redirect: 'manual',
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        const loc = upstream.headers.get('location');
        if (!loc) break;
        currentUrl = new URL(loc, currentUrl).href;
        await upstream.body?.cancel();
        upstream = null;
        continue;
      }
      break;
    }
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: `Upstream fetch failed: ${(err as Error).message}` }));
    return;
  }

  if (!upstream) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Too many redirects upstream' }));
    return;
  }

  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';

  // HLS playlists must be rewritten so every child request flows through the proxy with the same headers.
  if (isPlaylistMime(contentType, currentUrl)) {
    try {
      const text = await upstream.text();
      const rewritten = rewriteM3U8(text, currentUrl, headers, '/api/iptv/stream');
      res.statusCode = upstream.status;
      res.setHeader('content-type', contentType.includes('mpegurl') ? contentType : 'application/vnd.apple.mpegurl');
      // Clients (and any CDN hop) must always re-fetch the live playlist; but
      // let the browser cache it for a moment to smooth the polling loop.
      res.setHeader('cache-control', 'no-store, max-age=0');
      res.setHeader('access-control-allow-origin', '*');
      res.end(rewritten);
    } catch (err) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: `Playlist rewrite failed: ${(err as Error).message}` }));
    }
    return;
  }

  // Binary stream (segments / mp4 / ts): pipe through.
  res.statusCode = upstream.status;
  const passThrough = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
  for (const h of passThrough) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  res.setHeader('cache-control', 'public, max-age=2');
  res.setHeader('access-control-allow-origin', '*');
  if (!upstream.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
  // Backpressure: if the client stalls, stop reading upstream instead of
  // piling the whole segment into memory.
  nodeStream.on('error', () => {
    upstream?.body?.cancel().catch(() => undefined);
    res.destroy();
  });
  req.on('close', () => {
    if (!res.writableEnded) upstream?.body?.cancel().catch(() => undefined);
  });
  nodeStream.pipe(res);
}

/** Probe a stream URL without playing: used by the admin "Test stream" button. */
async function handleTestStream(
  res: import('http').ServerResponse,
  query: URLSearchParams
): Promise<void> {
  const targetUrl = decodeQueryValue(query.get('u') ?? '');
  let headers: StreamHeaders = {};
  try {
    headers = JSON.parse(decodeQueryValue(query.get('h') ?? '{}'));
  } catch {
    /* ignore */
  }
  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing url' }));
    return;
  }
  try {
    const res2 = await fetch(targetUrl, {
      headers: buildUpstreamHeaders(headers, new URLSearchParams()),
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
    });
    const isPlaylist = isPlaylistMime(res2.headers.get('content-type'), targetUrl);
    const payload = {
      finalStatus: res2.status,
      contentType: res2.headers.get('content-type'),
      isHlsPlaylist: isPlaylist,
      userAgentSent: headers.userAgent ?? '(default VLC UA)',
      refererSent: headers.referer ?? '(none)',
    };
    if (!isPlaylist) await res2.body?.cancel();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(payload));
  } catch (err) {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

/* ------------------------------------------------------------------ */
/* API router                                                          */
/* ------------------------------------------------------------------ */

function sendJson(res: import('http').ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

/* ---------------- Admin auth (stateless HMAC session tokens) ---------------- */

const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'sportylive';
// A stable signing key lets any serverless instance validate a token without
// shared memory. Rotating ADMIN_PASS (or this secret) invalidates old sessions.
const ADMIN_SESSION_SECRET =
  process.env.ADMIN_SESSION_SECRET || `sportylive:${ADMIN_USER}:${ADMIN_PASS}`;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function adminTokenSignature(payload: string): string {
  return createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('base64url');
}

function issueToken(): string {
  const payload = String(Date.now() + SESSION_TTL_MS);
  return `${payload}.${adminTokenSignature(payload)}`;
}

function isAuthed(req: import('http').IncomingMessage): boolean {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return timingSafeEqual(signature, adminTokenSignature(payload));
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return nodeTimingSafeEqual(ab, bb);
}

async function handleAdminAuth(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  path: string,
  method: string
): Promise<boolean> {
  // Login is the only open admin route.
  if (method === 'POST' && path === '/api/admin/login') {
    try {
      const body = JSON.parse(await readBody(req)) as { username?: string; password?: string };
      const userOk = timingSafeEqual(String(body.username ?? ''), ADMIN_USER);
      const passOk = timingSafeEqual(String(body.password ?? ''), ADMIN_PASS);
      if (userOk && passOk) {
        sendJson(res, 200, { token: issueToken() });
      } else {
        sendJson(res, 401, { error: 'Invalid username or password' });
      }
    } catch {
      sendJson(res, 400, { error: 'Invalid login payload' });
    }
    return true;
  }

  if (path === '/api/admin/session' && method === 'GET') {
    sendJson(res, 200, { authenticated: isAuthed(req) });
    return true;
  }

  if (!isAuthed(req)) {
    sendJson(res, 401, { error: 'Unauthorized — login required' });
    return true;
  }
  return false; // not handled — continue to admin handlers
}

async function readBody(req: import('http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

/* ---------------- Viewer accounts (username + password + country) ---------------- */

const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,24}$/;

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user: StoredUser): AppUser {
  return {
    id: user.id,
    username: user.username,
    country: user.country,
    countryName: findCountry(user.country)?.name ?? user.country,
    createdAt: user.createdAt,
  };
}

function bearerToken(req: import('http').IncomingMessage): string {
  const auth = req.headers.authorization ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

/** Remove expired viewer sessions; returns true when the store changed. */
function pruneUserSessions(store: StoreData): boolean {
  const now = Date.now();
  const before = store.userSessions.length;
  store.userSessions = store.userSessions.filter(
    (session) => Date.parse(session.expiresAt) > now
  );
  return store.userSessions.length !== before;
}

function currentUser(
  store: StoreData,
  req: import('http').IncomingMessage
): StoredUser | null {
  const token = bearerToken(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = store.userSessions.find((s) => s.tokenHash === tokenHash);
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    store.userSessions = store.userSessions.filter((s) => s.tokenHash !== tokenHash);
    // Fire-and-forget: this helper is synchronous, and a dropped prune is harmless.
    void saveStore().catch((err) =>
      console.error('[store] session prune failed:', (err as Error).message)
    );
    return null;
  }
  return store.users.find((u) => u.id === session.userId) ?? null;
}

function issueUserSession(store: StoreData, userId: string): string {
  pruneUserSessions(store);
  const token = randomBytes(32).toString('hex');
  const session: UserSessionRecord = {
    tokenHash: hashToken(token),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + USER_SESSION_TTL_MS).toISOString(),
  };
  store.userSessions.push(session);
  return token;
}

async function handleUserAuth(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  path: string,
  method: string,
  store: StoreData
): Promise<boolean> {
  if (!path.startsWith('/api/auth')) return false;

  if (method === 'POST' && path === '/api/auth/register') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        username?: unknown;
        password?: unknown;
        country?: unknown;
      };
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');
      const country = findCountry(String(body.country ?? ''));

      if (!USERNAME_RE.test(username)) {
        sendJson(res, 400, {
          error: 'Username must be 3–24 characters (letters, numbers, dot, dash or underscore).',
        });
        return true;
      }
      if (password.length < 8 || password.length > 128) {
        sendJson(res, 400, { error: 'Password must be between 8 and 128 characters.' });
        return true;
      }
      if (!country) {
        sendJson(res, 400, { error: 'Please choose a valid country.' });
        return true;
      }

      pruneUserSessions(store);
      const usernameLower = username.toLowerCase();
      if (store.users.some((u) => u.usernameLower === usernameLower)) {
        sendJson(res, 409, { error: 'That username is already taken.' });
        return true;
      }

      const passwordSalt = randomBytes(16).toString('hex');
      const user: StoredUser = {
        id: `usr-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`,
        username,
        usernameLower,
        country: country.code,
        passwordHash: hashPassword(password, passwordSalt),
        passwordSalt,
        createdAt: new Date().toISOString(),
      };
      store.users.push(user);
      const token = issueUserSession(store, user.id);
      await saveStore();
      sendJson(res, 201, { token, user: publicUser(user) });
    } catch {
      sendJson(res, 400, { error: 'Invalid sign-up payload.' });
    }
    return true;
  }

  if (method === 'POST' && path === '/api/auth/login') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        username?: unknown;
        password?: unknown;
      };
      const usernameLower = String(body.username ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const user = store.users.find((u) => u.usernameLower === usernameLower);
      const expected = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(64);
      const actual = Buffer.from(
        hashPassword(password, user?.passwordSalt ?? 'invalid-salt'),
        'hex'
      );
      const passwordOk = Boolean(user) && nodeTimingSafeEqual(expected, actual);
      if (!user || !passwordOk) {
        sendJson(res, 401, { error: 'Invalid username or password.' });
        return true;
      }
      const token = issueUserSession(store, user.id);
      await saveStore();
      sendJson(res, 200, { token, user: publicUser(user) });
    } catch {
      sendJson(res, 400, { error: 'Invalid login payload.' });
    }
    return true;
  }

  if (method === 'GET' && path === '/api/auth/me') {
    if (pruneUserSessions(store)) await saveStore();
    const user = currentUser(store, req);
    sendJson(res, 200, { user: user ? publicUser(user) : null });
    return true;
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const token = bearerToken(req);
    if (token) {
      const tokenHash = hashToken(token);
      const before = store.userSessions.length;
      store.userSessions = store.userSessions.filter((s) => s.tokenHash !== tokenHash);
      if (store.userSessions.length !== before) await saveStore();
    }
    sendJson(res, 200, { ok: true });
    return true;
  }

  sendJson(res, 404, { error: 'Not found' });
  return true;
}

/**
 * Server-sent events feed of store revisions. Admin edits (on this instance or
 * any other) fire `change` events so the web app can refetch instantly instead
 * of polling.
 */
function handleStoreEvents(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
): boolean {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('ready', {
    revision: getStoreRevision(),
    backend: storeBackend(),
    at: new Date().toISOString(),
  });

  const unsubscribe = onStoreChange((rev) =>
    send('change', { revision: rev, at: new Date().toISOString() })
  );

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    if (poll) clearInterval(poll);
    if (lifetime) clearTimeout(lifetime);
    unsubscribe();
    res.end();
  };

  // Comment frames keep proxies and browsers from dropping an idle stream.
  const heartbeat = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 15_000);

  // Neon writes land in Postgres, so other server instances are detected by
  // polling the revision cursor and pulling the newer snapshot into cache.
  // Serverless lambdas hold one stream each, so poll less often there.
  const poll =
    storeBackend() === 'neon'
      ? setInterval(
          () => {
            syncFromDatabase().catch((err) =>
              console.error('[sse] revision poll failed:', (err as Error).message)
            );
          },
          isServerlessRuntime() ? 10_000 : 4_000
        )
      : null;

  // Vercel caps function duration, so the stream ends deliberately and the
  // browser reconnects (`retry: 3000`) with a fresh `ready` frame.
  const lifetime = isServerlessRuntime() ? setTimeout(close, 45_000) : null;

  req.on('close', close);
  req.on('error', close);
  return true;
}

/**
 * Handles every /api/* request. Returns false when the request is not API,
 * letting the caller fall back to static file serving.
 */
export async function handleApiRequest(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse
): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = (req.method ?? 'GET').toUpperCase();

  // ---------------- Public: ads.txt ----------------
  // Served dynamically so the admin publisher id (or VITE_ADSENSE_CLIENT)
  // always matches the ad code. A static public/ads.txt would shadow this
  // route on the Vercel CDN, so keep it out of the build output.
  if (method === 'GET' && path === '/ads.txt') {
    await ensureStoreReady();
    const ads = loadStore().settings?.ads;
    const client = (ads?.publisherId?.trim() || (process.env.VITE_ADSENSE_CLIENT ?? '').trim()).toLowerCase();
    const publisher = client.replace(/^ca-/, '');
    const valid = /^pub-\d{8,20}$/.test(publisher);
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=600, s-maxage=600');
    res.end(
      valid
        ? `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`
        : '# SportyLive: AdSense publisher id is not configured yet.\n',
    );
    return true;
  }

  // ---------------- Public: event share page (OG preview + redirect) -------
  // Shares point here: social crawlers read the Open Graph tags (event teams
  // + logo as the thumbnail) while people are redirected straight into the
  // app's player via /?watch=<id>.
  const evShare = path.match(/^\/event\/([^/]+)$/);
  if (evShare && method === 'GET') {
    const store = loadStore();
    const id = decodeURIComponent(evShare[1]);
    const live = store.liveEvents.find((e) => e.id === id);
    const upc = store.upcomingEvents.find((e) => e.id === id);
    const ev = live ?? upc;
    const isLive = Boolean(live);
    const host = String(req.headers.host ?? 'sporty-live.vercel.app').split(/[,\s]/)[0];
    const origin = host.startsWith('localhost') || host.startsWith('127.') ? `http://${host}` : `https://${host}`;
    const appUrl = `${origin}/?watch=${encodeURIComponent(id)}`;

    let title = 'SportyLive — Live Sports Streaming and Channels';
    let description = 'Live sports streaming and channels for football, basketball, tennis, boxing, and Formula 1.';
    let image = `${origin}/icon-512.png`;
    if (ev) {
      const names = `${ev.homeTeam} vs ${ev.awayTeam}`;
      const league = ev.league ? `${ev.league} — ` : '';
      title = isLive ? `LIVE NOW — ${names} | SportyLive` : `Upcoming — ${names} | SportyLive`;
      description = isLive
        ? `${league}Watch ${names} live on SportyLive.`
        : `${league}${names} kicks off soon — watch it on SportyLive.`;
      const logo =
        ('homeLogoUrl' in ev && ev.homeLogoUrl) ||
        ('awayLogoUrl' in ev && ev.awayLogoUrl) ||
        ('leagueLogo' in ev && (ev as AdminUpcomingEvent).leagueLogo) ||
        undefined;
      if (logo) image = logo.startsWith('http') ? logo : `${origin}${logo}`;
    }

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:url" content="${esc(appUrl)}" />
<meta property="og:type" content="video.other" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0;url=${esc(appUrl)}" />
<script>location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body>
<p style="font-family:system-ui;padding:24px">Opening SportyLive… <a href="${esc(appUrl)}">Open here</a> if nothing happens.</p>
</body>
</html>`;
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=120',
    });
    res.end(html);
    return true;
  }

  if (!path.startsWith('/api')) return false;

  // The Neon-backed store loads once per process (first request pays the round
  // trip); every handler below then reads the in-memory cache synchronously.
  await ensureStoreReady();

  const store = loadStore();

  // Viewer account routes (public).
  if (await handleUserAuth(req, res, path, method, store)) return true;

  // Visitor analytics heartbeat (public, anonymous device id).
  if (path === '/api/analytics/ping' && method === 'POST') {
    let body: { vid?: unknown } = {};
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}') as { vid?: unknown };
    } catch {
      /* empty body is fine — a malformed vid is rejected below */
    }
    const vid = typeof body.vid === 'string' ? body.vid : '';
    const result = recordVisitorPing(vid);
    if (!result.ok) {
      sendJson(res, 400, { error: 'invalid visitor id' });
      return true;
    }
    sendJson(res, 200, { ok: true, onlineNow: result.onlineNow });
    return true;
  }

  // Admin routes: authenticate first (except the login itself).
  if (path.startsWith('/api/admin')) {
    const handled = await handleAdminAuth(req, res, path, method);
    if (handled) return true;
  }

  // ---------------- Public: app data ----------------
  if (method === 'GET' && path === '/api/data') {
    // Channels belonging to a disabled playlist are hidden from the site.
    sendJson(res, 200, getAppData());
    return true;
  }

  // Admin data feed includes disabled playlists so they stay manageable.
  if (method === 'GET' && path === '/api/admin/data') {
    sendJson(res, 200, getAppData(true));
    return true;
  }

  // ---------------- Public: realtime store revisions (SSE) ----------------
  if (method === 'GET' && path === '/api/events') {
    handleStoreEvents(req, res);
    return true;
  }

  // ---------------- Cron: playlist auto-sync (Vercel Cron) ----------------
  // Serverless has no long-lived scheduler, so Vercel Cron calls this instead.
  // When CRON_SECRET is configured Vercel sends it as a bearer token.
  if (path === '/api/cron/playlist-sync') {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return true;
    }
    const startedAt = Date.now();
    const health = await runAutoSync();
    sendJson(res, 200, {
      ok: true,
      backend: storeBackend(),
      ms: Date.now() - startedAt,
      playlists: loadStore().playlists.filter((p) => p.autoSync && p.enabled !== false).length,
      ...health,
    });
    return true;
  }

  // ---------------- Public: stream proxy ----------------
  if (path === '/api/iptv/stream') {
    await handleStreamProxy(req, res, url.searchParams, '/api/iptv/stream');
    return true;
  }

  if (method === 'GET' && path === '/api/admin/test-stream') {
    await handleTestStream(res, url.searchParams);
    return true;
  }

  // ---------------- Playlists ----------------
  if (path === '/api/admin/playlists' && method === 'GET') {
    sendJson(res, 200, store.playlists);
    return true;
  }

  if (path === '/api/admin/playlists' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        name?: string;
        url?: string;
        content?: string;
      };
      const name = (body.name ?? '').trim() || 'Imported Playlist';
      let text = '';
      let sourceUrl: string | undefined;
      if (body.content && body.content.trim()) {
        text = body.content;
      } else if (body.url && /^https?:\/\//i.test(body.url)) {
        sourceUrl = body.url.trim();
        text = await fetchPlaylistText(sourceUrl);
      } else {
        sendJson(res, 400, { error: 'Provide a playlist URL or paste playlist text' });
        return true;
      }

      const playlistId = makeId('pl');
      const channels = channelsFromText(playlistId, name, text);
      if (channels.length === 0) {
        sendJson(res, 400, { error: 'No channels found — is this a valid M3U playlist?' });
        return true;
      }

      const playlist: IptvPlaylist = {
        id: playlistId,
        name,
        sourceUrl,
        sourceContent: sourceUrl ? undefined : text,
        channelCount: channels.length,
        importedAt: new Date().toISOString(),
        enabled: true,
      };
      channels.forEach((c) => (c.playlistId = playlist.id));
      store.playlists.push(playlist);
      store.channels.push(...channels);
      await saveStore();

      const groups = [...new Set(channels.map((c) => c.group).filter(Boolean))] as string[];
      sendJson(res, 201, {
        playlist,
        channelCount: channels.length,
        sample: channels.slice(0, 5).map((c) => `${c.name}${c.group ? ` (${c.group})` : ''}`),
        groups: groups.slice(0, 30),
      });
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message });
    }
    return true;
  }

  const plRefresh = path.match(/^\/api\/admin\/playlists\/([^/]+)\/refresh$/);
  if (plRefresh && method === 'POST') {
    const playlist = store.playlists.find((p) => p.id === plRefresh[1]);
    if (!playlist) {
      sendJson(res, 404, { error: 'Playlist not found' });
      return true;
    }
    try {
      const stats = await syncPlaylistChannels(playlist);
      notifySyncChanges(playlist.name, stats.added, stats.removed);
      sendJson(res, 200, { playlist, ...stats, channelCount: playlist.channelCount });
    } catch (err) {
      playlist.lastError = (err as Error).message;
      await saveStore();
      notifySyncError(playlist.name, (err as Error).message);
      sendJson(res, 502, { error: (err as Error).message });
    }
    return true;
  }

  const plSync = path.match(/^\/api\/admin\/playlists\/([^/]+)\/sync$/);
  if (plSync && method === 'POST') {
    const playlist = store.playlists.find((p) => p.id === plSync[1]);
    if (!playlist) {
      sendJson(res, 404, { error: 'Playlist not found' });
      return true;
    }
    try {
      const stats = await syncPlaylistChannels(playlist);
      notifySyncChanges(playlist.name, stats.added, stats.removed);
      sendJson(res, 200, { playlist, ...stats, channelCount: playlist.channelCount });
    } catch (err) {
      playlist.lastError = (err as Error).message;
      await saveStore();
      notifySyncError(playlist.name, (err as Error).message);
      sendJson(res, 502, { error: (err as Error).message });
    }
    return true;
  }

  const plPatch = path.match(/^\/api\/admin\/playlists\/([^/]+)$/);
  if (plPatch && method === 'PATCH') {
    const playlist = store.playlists.find((p) => p.id === plPatch[1]);
    if (!playlist) {
      sendJson(res, 404, { error: 'Playlist not found' });
      return true;
    }
    try {
      const body = JSON.parse(await readBody(req)) as Partial<IptvPlaylist>;
      if (typeof body.autoSync === 'boolean') playlist.autoSync = body.autoSync;
      if (typeof body.enabled === 'boolean') playlist.enabled = body.enabled;
      if (typeof body.name === 'string' && body.name.trim()) playlist.name = body.name.trim();
      await saveStore();
      sendJson(res, 200, playlist);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  const plDelete = path.match(/^\/api\/admin\/playlists\/([^/]+)$/);
  if (plDelete && method === 'DELETE') {
    const before = store.playlists.length;
    store.playlists = store.playlists.filter((p) => p.id !== plDelete[1]);
    store.channels = store.channels.filter((c) => c.playlistId !== plDelete[1]);
    if (store.playlists.length === before) {
      sendJson(res, 404, { error: 'Playlist not found' });
    } else {
      await saveStore();
      sendJson(res, 200, { ok: true });
    }
    return true;
  }

  // ---------------- Channels ----------------
  if (path === '/api/admin/channels' && method === 'GET') {
    sendJson(res, 200, store.channels);
    return true;
  }

  const chPatch = path.match(/^\/api\/admin\/channels\/([^/]+)$/);
  if (chPatch && method === 'PATCH') {
    const ch = store.channels.find((c) => c.id === chPatch[1]);
    if (!ch) {
      sendJson(res, 404, { error: 'Channel not found' });
      return true;
    }
    try {
      const body = JSON.parse(await readBody(req)) as Partial<IptvChannel>;
      if (typeof body.sport === 'string') ch.sport = body.sport as IptvChannel['sport'];
      if (typeof body.shelf === 'string') ch.shelf = body.shelf as IptvChannel['shelf'];
      if (typeof body.quality === 'string') ch.quality = body.quality as IptvChannel['quality'];
      if (typeof body.enabled === 'boolean') ch.enabled = body.enabled;
      if (typeof body.name === 'string' && body.name.trim()) ch.name = body.name.trim();
      if (typeof body.group === 'string') ch.group = body.group.trim() || undefined;
      if (typeof body.tvgId === 'string') ch.tvgId = body.tvgId.trim() || undefined;
      if (typeof body.tvgLogo === 'string') ch.tvgLogo = body.tvgLogo.trim() || undefined;
      if (body.headers && typeof body.headers === 'object') ch.headers = body.headers as StreamHeaders;
      await saveStore();
      sendJson(res, 200, ch);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  const chDelete = path.match(/^\/api\/admin\/channels\/([^/]+)$/);
  if (chDelete && method === 'DELETE') {
    const before = store.channels.length;
    store.channels = store.channels.filter((c) => c.id !== chDelete[1]);
    if (store.channels.length === before) sendJson(res, 404, { error: 'Channel not found' });
    else {
      await saveStore();
      sendJson(res, 200, { ok: true });
    }
    return true;
  }

  // ---------------- Live events ----------------
  if (path === '/api/admin/events' && method === 'GET') {
    sendJson(res, 200, { liveEvents: store.liveEvents, upcomingEvents: store.upcomingEvents });
    return true;
  }

  // ---------------- Match import (JSON / M3U feeds) ----------------
  if (path === '/api/admin/events/import' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        content?: string;
        sourceUrl?: string;
        format?: string;
      };
      let text = (body.content ?? '').trim();
      if (!text && body.sourceUrl) {
        const res2 = await fetch(body.sourceUrl, {
          headers: { 'user-agent': 'SportyLive/1.0 (match importer)' },
          signal: AbortSignal.timeout(30_000),
          redirect: 'follow',
        });
        if (!res2.ok) throw new Error(`HTTP ${res2.status} while fetching match feed`);
        text = await res2.text();
      }
      if (!text) {
        sendJson(res, 400, { error: 'Paste match JSON/M3U or provide a source URL' });
        return true;
      }
      const format =
        body.format === 'json' || body.format === 'm3u'
          ? body.format
          : detectMatchFormat(text);
      const matches = format === 'm3u' ? parseMatchesFromM3U(text) : parseMatchesFromJson(JSON.parse(text));
      const stats = importMatchesIntoStore(store, matches);
      await saveStore();
      sendJson(res, 200, { ok: true, format, matched: matches.length, ...stats });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  // ---------------- Bulk delete events ----------------
  if (path === '/api/admin/events/delete-many' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as { ids?: unknown };
      const ids = Array.isArray(body.ids)
        ? [...new Set((body.ids as unknown[]).map((x) => String(x)).filter(Boolean))]
        : [];
      if (ids.length === 0) {
        sendJson(res, 400, { error: 'No event ids provided' });
        return true;
      }
      const idSet = new Set(ids);
      const beforeL = store.liveEvents.length;
      const beforeU = store.upcomingEvents.length;
      store.liveEvents = store.liveEvents.filter((e) => !idSet.has(e.id));
      store.upcomingEvents = store.upcomingEvents.filter((e) => !idSet.has(e.id));
      const deleted = beforeL - store.liveEvents.length + beforeU - store.upcomingEvents.length;
      await saveStore();
      sendJson(res, 200, { ok: true, deleted, missing: ids.length - deleted });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  if (path === '/api/admin/events' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      const headers = (body.headers ?? {}) as StreamHeaders;
      if (body.kind === 'upcoming') {
        const ev: AdminUpcomingEvent = {
          id: makeId('upev'),
          homeTeam: String(body.homeTeam ?? 'TBD'),
          awayTeam: String(body.awayTeam ?? 'TBD'),
          sport: String(body.sport ?? 'football') as AdminUpcomingEvent['sport'],
          league: String(body.league ?? 'Friendly'),
          channel: String(body.channel ?? 'SportyLive 1 HD'),
          dateKey: String(body.dateKey ?? new Date().toISOString().slice(0, 10)),
          time: String(body.time ?? ''),
          streamUrl: body.streamUrl ? String(body.streamUrl) : undefined,
          headers,
          status: (body.status ? String(body.status) : 'upcoming') as AdminUpcomingEvent['status'],
          enabled: body.enabled !== false,
        };
        // Channel-backed extra streams for the player switcher.
        if (Array.isArray(body.channelIds)) {
          const ids = [...new Set((body.channelIds as unknown[]).map((x) => String(x)).filter(Boolean))];
          const unknown = ids.filter((cid) => !store.channels.some((c) => c.id === cid));
          if (unknown.length > 0) {
            sendJson(res, 400, { error: `Selected channel not found: ${unknown.join(', ')}` });
            return true;
          }
          ev.channelIds = ids;
          if (ids.length > 0 && !ev.streamUrl) {
            const src = store.channels.find((c) => c.id === ids[0])!;
            ev.streamUrl = src.url;
            if (src.headers && Object.keys(src.headers).length > 0) ev.headers = src.headers;
          }
        }
        const extra = parseCustomStreams(body.customStreams);
        if (extra) ev.customStreams = extra;
        store.upcomingEvents.unshift(ev);
        await saveStore();
        notifyNewEvent('upcoming', ev.homeTeam, ev.awayTeam, ev.league);
        sendJson(res, 201, ev);
      } else {
        const ev: AdminLiveEvent = {
          id: makeId('lvev'),
          homeTeam: String(body.homeTeam ?? 'Home'),
          awayTeam: String(body.awayTeam ?? 'Away'),
          sport: String(body.sport ?? 'football') as AdminLiveEvent['sport'],
          league: String(body.league ?? 'Friendly'),
          venue: String(body.venue ?? ''),
          homeScore: Number(body.homeScore ?? 0),
          awayScore: Number(body.awayScore ?? 0),
          statusLabel: body.statusLabel ? String(body.statusLabel) : undefined,
          viewers: body.viewers ? String(body.viewers) : undefined,
          quality: (body.quality === '4K' ? '4K' : 'HD') as AdminLiveEvent['quality'],
          homeLogoUrl: body.homeLogoUrl ? String(body.homeLogoUrl) : undefined,
          awayLogoUrl: body.awayLogoUrl ? String(body.awayLogoUrl) : undefined,
          channelId: body.channelId ? String(body.channelId) : undefined,
          channelIds: Array.isArray(body.channelIds)
            ? (body.channelIds as unknown[]).map((x) => String(x)).filter(Boolean)
            : undefined,
          streamUrl: String(body.streamUrl ?? ''),
          headers,
          status: (body.status ? String(body.status) : 'live') as AdminLiveEvent['status'],
          dateKey: body.dateKey ? String(body.dateKey) : undefined,
          time: body.time ? String(body.time) : undefined,
          enabled: body.enabled !== false,
        };
        const extraStreams = parseCustomStreams(body.customStreams);
        if (extraStreams) ev.customStreams = extraStreams;
        // Failover sources: every referenced channel must exist. channelIds[0]
        // is the primary and mirrors channelId; the rest are fallback streams.
        const ids = [...new Set([...(ev.channelIds ?? []), ...(ev.channelId ? [ev.channelId] : [])])];
        const unknown = ids.filter((cid) => !store.channels.some((c) => c.id === cid));
        if (unknown.length > 0) {
          sendJson(res, 400, { error: `Selected channel not found: ${unknown.join(', ')}` });
          return true;
        }
        ev.channelIds = ids;
        ev.channelId = ids[0];
        // When streaming from channels, seed the stream fields from the primary
        // as a fallback and keep the ids so playback follows auto-sync.
        if (ev.channelId && !ev.streamUrl) {
          const src = store.channels.find((c) => c.id === ev.channelId)!;
          ev.streamUrl = src.url;
          if (src.headers && Object.keys(src.headers).length > 0) ev.headers = src.headers;
        }
        if (ids.length === 0 && !ev.streamUrl) {
          sendJson(res, 400, { error: 'Pick a channel or provide a stream URL for live events' });
          return true;
        }
        store.liveEvents.unshift(ev);
        await saveStore();
        notifyNewEvent('live', ev.homeTeam, ev.awayTeam, ev.league);
        sendJson(res, 201, ev);
      }
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  /** Manual push alert from the admin Events tab (templates or custom copy). */
  if (path === '/api/admin/events/notify' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        id?: string;
        template?: string;
        title?: string;
        body?: string;
      };
      const id = String(body.id ?? '');
      const ev =
        store.liveEvents.find((e) => e.id === id) ??
        store.upcomingEvents.find((e) => e.id === id);
      if (!ev) {
        sendJson(res, 404, { error: 'Event not found' });
        return true;
      }
      const isLive = store.liveEvents.some((e) => e.id === id);
      const names = `${ev.homeTeam} vs ${ev.awayTeam}`;
      const league = ev.league ? `${ev.league} — ` : '';
      const template = String(body.template ?? (isLive ? 'live_now' : 'starting_soon'));
      const kickoffMs = 'startTimestampMs' in ev && ev.startTimestampMs ? Number(ev.startTimestampMs) : null;
      let title = String(body.title ?? '').trim();
      let text = String(body.body ?? '').trim();
      if (!title && template === 'live_now') {
        title = `LIVE NOW — ${names}`;
        text = text || `${league}Match is underway — watch it live on SportyLive.`;
      } else if (!title && template === 'starting_soon') {
        title = `Starting soon — ${names}`;
        if (!text) {
          text = kickoffMs
            ? `Kickoff in ${Math.max(1, Math.round((kickoffMs - Date.now()) / 60000))} min — watch on SportyLive.`
            : `Kickoff soon — watch on SportyLive.`;
        }
      } else if (!title) {
        // Custom copy with the event as the fallback subject.
        title = isLive ? `LIVE — ${names}` : `Upcoming — ${names}`;
        text = text || `${league}${isLive ? 'Watch it live' : 'Get ready for kickoff'} on SportyLive.`;
      }
      if (!text) {
        text = isLive ? 'Watch it live on SportyLive.' : 'Watch on SportyLive.';
      }
      const result = await sendEventAlert({ id: ev.id, homeTeam: ev.homeTeam, awayTeam: ev.awayTeam }, title, text);
      sendJson(res, 200, { ok: result.ok, vapid: result.vapid, onesignal: result.onesignal });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  const evPatch = path.match(/^\/api\/admin\/events\/([^/]+)$/);
  if (evPatch && method === 'PATCH') {
    const live = store.liveEvents.find((e) => e.id === evPatch[1]);
    const upc = store.upcomingEvents.find((e) => e.id === evPatch[1]);
    const target = live ?? upc;
    if (!target) {
      sendJson(res, 404, { error: 'Event not found' });
      return true;
    }
    try {
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      for (const key of ['homeTeam', 'awayTeam', 'league', 'venue', 'statusLabel', 'viewers', 'channel', 'dateKey', 'time', 'streamUrl', 'homeLogoUrl', 'awayLogoUrl', 'channelId', 'status'] as const) {
        if (typeof body[key] === 'string') (target as unknown as Record<string, unknown>)[key] = body[key];
      }
      if (typeof body.sport === 'string') (target as { sport: string }).sport = body.sport;
      if (typeof body.enabled === 'boolean') target.enabled = body.enabled;
      if (
        (typeof body.startTimestampMs === 'number' && Number.isFinite(body.startTimestampMs)) ||
        body.startTimestampMs === null
      ) {
        (target as { startTimestampMs?: number }).startTimestampMs =
          body.startTimestampMs === null ? undefined : Number(body.startTimestampMs);
      }
      if (body.headers && typeof body.headers === 'object') target.headers = body.headers as StreamHeaders;
      if (Array.isArray(body.customStreams)) {
        // Admin-attached extra streams shown in the player switcher alongside
        // the imported primary.
        target.customStreams = (parseCustomStreams(body.customStreams) ?? []) as never;
      }
      if (typeof body.homeScore === 'number') (target as { homeScore?: number }).homeScore = body.homeScore;
      if (typeof body.awayScore === 'number') (target as { awayScore?: number }).awayScore = body.awayScore;
      if (Array.isArray(body.channelIds) && 'channelId' in target) {
        const liveEv = target as AdminLiveEvent;
        const ids = [...new Set((body.channelIds as unknown[]).map((x) => String(x)).filter(Boolean))];
        const unknown = ids.filter((cid) => !store.channels.some((c) => c.id === cid));
        if (unknown.length > 0) {
          sendJson(res, 400, { error: `Selected channel not found: ${unknown.join(', ')}` });
          return true;
        }
        liveEv.channelIds = ids;
        liveEv.channelId = ids[0];
        // Keep a resolvable stream: seed from the new primary when the event has
        // no custom URL of its own.
        if (ids.length > 0 && !liveEv.streamUrl) {
          const src = store.channels.find((c) => c.id === ids[0])!;
          liveEv.streamUrl = src.url;
          if (src.headers && Object.keys(src.headers).length > 0) liveEv.headers = src.headers;
        }
      } else if (Array.isArray(body.channelIds) && !('channelId' in target)) {
        // Upcoming fixtures support channel-backed extra streams too.
        const ids = [...new Set((body.channelIds as unknown[]).map((x) => String(x)).filter(Boolean))];
        const unknown = ids.filter((cid) => !store.channels.some((c) => c.id === cid));
        if (unknown.length > 0) {
          sendJson(res, 400, { error: `Selected channel not found: ${unknown.join(', ')}` });
          return true;
        }
        (target as AdminUpcomingEvent).channelIds = ids;
        if (ids.length > 0 && !target.streamUrl) {
          const src = store.channels.find((c) => c.id === ids[0])!;
          target.streamUrl = src.url;
          if (src.headers && Object.keys(src.headers).length > 0) target.headers = src.headers;
        }
      }
      if (typeof body.quality === 'string' && (body.quality === '4K' || body.quality === 'HD')) {
        (target as { quality?: string }).quality = body.quality;
      }
      await saveStore();
      sendJson(res, 200, target);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  const evDelete = path.match(/^\/api\/admin\/events\/([^/]+)$/);
  if (evDelete && method === 'DELETE') {
    const beforeL = store.liveEvents.length;
    const beforeU = store.upcomingEvents.length;
    store.liveEvents = store.liveEvents.filter((e) => e.id !== evDelete[1]);
    store.upcomingEvents = store.upcomingEvents.filter((e) => e.id !== evDelete[1]);
    if (beforeL === store.liveEvents.length && beforeU === store.upcomingEvents.length) {
      sendJson(res, 404, { error: 'Event not found' });
    } else {
      await saveStore();
      sendJson(res, 200, { ok: true });
    }
    return true;
  }

  // ---------------- Banners ----------------
  if (path === '/api/admin/banners' && method === 'GET') {
    sendJson(res, 200, store.banners);
    return true;
  }

  if (path === '/api/admin/banners' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      const banner: AdminBanner = {
        id: makeId('bnr'),
        sport: String(body.sport ?? 'football') as AdminBanner['sport'],
        headlineTop: String(body.headlineTop ?? ''),
        headlineHighlight: String(body.headlineHighlight ?? ''),
        headlineBottom: String(body.headlineBottom ?? ''),
        subtitleLine1: String(body.subtitleLine1 ?? ''),
        subtitleLine2: String(body.subtitleLine2 ?? ''),
        ctaLabel: String(body.ctaLabel ?? 'Watch Live'),
        bgGradient: String(
          body.bgGradient ||
            'linear-gradient(115deg, #062163 0%, #0F47C7 45%, #092670 100%)'
        ),
        imageUrl: body.imageUrl ? String(body.imageUrl).trim() : undefined,
        targetEventId: body.targetEventId ? String(body.targetEventId) : undefined,
        enabled: body.enabled !== false,
      };
      store.banners.unshift(banner);
      await saveStore();
      sendJson(res, 201, banner);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  const bnrPatch = path.match(/^\/api\/admin\/banners\/([^/]+)$/);
  if (bnrPatch && method === 'PATCH') {
    const banner = store.banners.find((b) => b.id === bnrPatch[1]);
    if (!banner) {
      sendJson(res, 404, { error: 'Banner not found' });
      return true;
    }
    try {
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      for (const key of [
        'headlineTop',
        'headlineHighlight',
        'headlineBottom',
        'subtitleLine1',
        'subtitleLine2',
        'ctaLabel',
        'bgGradient',
        'imageUrl',
        'sport',
      ] as const) {
        if (typeof body[key] === 'string') banner[key] = body[key] as never;
      }
      if (typeof body.enabled === 'boolean') banner.enabled = body.enabled;
      if (body.targetEventId !== undefined) {
        banner.targetEventId = body.targetEventId ? String(body.targetEventId) : undefined;
      }
      await saveStore();
      sendJson(res, 200, banner);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  const bnrDelete = path.match(/^\/api\/admin\/banners\/([^/]+)$/);
  if (bnrDelete && method === 'DELETE') {
    const before = store.banners.length;
    store.banners = store.banners.filter((b) => b.id !== bnrDelete[1]);
    if (store.banners.length === before) sendJson(res, 404, { error: 'Banner not found' });
    else {
      await saveStore();
      sendJson(res, 200, { ok: true });
    }
    return true;
  }

  // ---------------- Web push notifications ----------------
  if (path === '/api/admin/push/config' && method === 'GET') {
    sendJson(res, 200, {
      publicKey: getVapidPublicKey(),
      prefs: getPushPrefs(),
      subscriptions: getSubscriptionCount(),
      onesignalReady: Boolean(
        (process.env.ONESIGNAL_APP_ID ?? '').trim() && (process.env.ONESIGNAL_REST_API_KEY ?? '').trim(),
      ),
    });
    return true;
  }

  if (path === '/api/admin/push/subscribe' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const result = addSubscription(body, String(req.headers['user-agent'] ?? ''));
      if (!result.ok) {
        sendJson(res, 400, { error: result.error });
      } else {
        sendJson(res, 201, { subscribed: true, subscriptions: result.count });
      }
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  if (path === '/api/admin/push/unsubscribe' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as { endpoint?: string };
      const count = removeSubscription(String(body.endpoint ?? ''));
      sendJson(res, 200, { subscribed: false, subscriptions: count });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  if (path === '/api/admin/push/test' && method === 'POST') {
    const result = await sendPush({
      title: 'SportyLive Admin test notification',
      body: 'Push notifications are working on this device.',
      url: '/admin',
      tag: 'sportylive-test',
      kind: 'test',
    });
    sendJson(res, 200, result);
    return true;
  }

  /** Manual broadcast to all site users (OneSegment viewers + admin devices). */
  if (path === '/api/admin/push/broadcast' && method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req)) as {
        title?: string;
        body?: string;
        url?: string;
      };
      const title = String(body.title ?? '').trim();
      const text = String(body.body ?? '').trim();
      if (!title || !text) {
        sendJson(res, 400, { error: 'Title and message are required' });
        return true;
      }
      const payload = {
        title,
        body: text,
        url: String(body.url ?? '').trim() || '/',
        tag: `broadcast-${Date.now()}`,
        kind: 'event' as const,
      };
      const emptyVapid = { sent: 0, failed: 0, removed: 0, configured: false };
      const [vapid, onesignal] = await Promise.all([
        sendPush(payload).catch(() => emptyVapid),
        sendOneSignalPush(payload).catch(() => ({ ok: false, configured: false })),
      ]);
      sendJson(res, 200, {
        ok: vapid.sent > 0 || onesignal.ok,
        vapid,
        onesignal,
      });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  if (path === '/api/admin/push/prefs' && method === 'PATCH') {
    try {
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      const prefs = savePushPrefs(body);
      sendJson(res, 200, prefs);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  // ---------------- Visitor analytics ----------------
  if (path === '/api/admin/analytics' && method === 'GET') {
    sendJson(res, 200, visitorAnalyticsSummary());
    return true;
  }

  // ---------------- Registered viewers (site users) ----------------
  if (path === '/api/admin/users' && method === 'GET') {
    const users = [...loadStore().users]
      .filter((u) => u && u.id)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    sendJson(res, 200, {
      total: users.length,
      // Never expose password material.
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        country: u.country,
        createdAt: u.createdAt,
      })),
    });
    return true;
  }

  // ---------------- Site settings ----------------
  if (path === '/api/admin/settings' && method === 'GET') {
    sendJson(res, 200, store.settings);
    return true;
  }

  if (path === '/api/admin/settings' && method === 'PATCH') {
    try {
      const body = JSON.parse(await readBody(req)) as Record<string, unknown>;
      const next = { ...store.settings };
      const keys: (keyof typeof next)[] = [
        'siteName',
        'tagline',
        'supportEmail',
        'supportPhone',
        'whatsapp',
        'telegram',
        'telegramChannel',
        'telegramGroup',
        'website',
        'address',
        'hours',
        'twitter',
        'instagram',
        'facebook',
        'youtube',
        'footerNote',
        'copyright',
      ];
      for (const key of keys) {
        if (typeof body[key] === 'string') {
          next[key] = (body[key] as string).trim() as never;
        }
      }
      if (body.ads && typeof body.ads === 'object' && !Array.isArray(body.ads)) {
        next.ads = normalizeAdsSettings(body.ads as Partial<AdsSettings>, next.ads);
      }
      next.updatedAt = new Date().toISOString();
      store.settings = next;
      await saveStore();
      sendJson(res, 200, store.settings);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
    return true;
  }

  sendJson(res, 404, { error: `Unknown API route: ${method} ${path}` });
  return true;
}
