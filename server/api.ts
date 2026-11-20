import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual as nodeTimingSafeEqual,
} from 'crypto';
import { findCountry } from '../src/data/countries';
import type { AppUser } from '../src/types/user';
import { Readable } from 'stream';
import { guessSport, parseM3U, shortCode } from '../src/lib/m3u';
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
} from '../src/types/iptv';
import {
  ensureStoreReady,
  getAppData,
  getStoreRevision,
  isServerlessRuntime,
  loadStore,
  makeId,
  onStoreChange,
  saveStore,
  storeBackend,
  syncFromDatabase,
  type StoredUser,
  type StoreData,
  type UserSessionRecord,
} from './store';
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
  sendPush,
} from './push';

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
    connection: 'close',
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
async function syncPlaylistChannels(
  playlist: IptvPlaylist,
): Promise<{ added: number; updated: number; removed: number }> {
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
  return { added, updated: kept, removed };
}

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

/** Every 5 minutes, re-sync every playlist with autoSync enabled. */
export function startAutoSync(intervalMs = 5 * 60 * 1000): void {
  if (autoSyncTimer) return;
  autoSyncTimer = setInterval(() => {
    void runAutoSync();
  }, intervalMs);
  console.log(`[auto-sync] scheduler running every ${Math.round(intervalMs / 60000)} min`);
}

export async function runAutoSync(): Promise<void> {
  // The store may still be loading on a cold start; the next tick picks it up.
  await ensureStoreReady();
  const store = loadStore();
  const due = store.playlists.filter((p: IptvPlaylist) => p.autoSync && p.enabled !== false);
  if (due.length === 0) return;
  await Promise.all(
    due.map(async (p: IptvPlaylist) => {
      try {
        const stats = await syncPlaylistChannels(p);
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
      res.setHeader('cache-control', 'no-store');
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
  res.setHeader('cache-control', 'no-store');
  if (!upstream.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(upstream.body as import('stream/web').ReadableStream);
  nodeStream.pipe(res);
  nodeStream.on('error', () => res.destroy());
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

/* ---------------- Admin auth (session tokens, in-memory) ---------------- */

const ADMIN_USER = process.env.ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'sportylive';
const adminSessions = new Set<string>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessionExpiry = new Map<string, number>();

function issueToken(): string {
  const token = randomUUID().replace(/-/g, '') + randomBytes(12).toString('hex');
  adminSessions.add(token);
  sessionExpiry.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isAuthed(req: import('http').IncomingMessage): boolean {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!adminSessions.has(token)) return false;
  const exp = sessionExpiry.get(token) ?? 0;
  if (Date.now() > exp) {
    adminSessions.delete(token);
    sessionExpiry.delete(token);
    return false;
  }
  return true;
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

  if (!path.startsWith('/api')) return false;

  // The Neon-backed store loads once per process (first request pays the round
  // trip); every handler below then reads the in-memory cache synchronously.
  await ensureStoreReady();

  const store = loadStore();

  // Viewer account routes (public).
  if (await handleUserAuth(req, res, path, method, store)) return true;

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
    await runAutoSync();
    sendJson(res, 200, {
      ok: true,
      backend: storeBackend(),
      ms: Date.now() - startedAt,
      playlists: loadStore().playlists.filter((p) => p.autoSync && p.enabled !== false).length,
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
          streamUrl: String(body.streamUrl ?? ''),
          headers,
          status: (body.status ? String(body.status) : 'live') as AdminLiveEvent['status'],
          dateKey: body.dateKey ? String(body.dateKey) : undefined,
          time: body.time ? String(body.time) : undefined,
          enabled: body.enabled !== false,
        };
        // When streaming from an existing channel, seed the stream fields from
        // it as a fallback and keep channelId so playback follows auto-sync.
        if (ev.channelId) {
          const src = store.channels.find((c) => c.id === ev.channelId);
          if (!src) {
            sendJson(res, 400, { error: 'Selected channel not found' });
            return true;
          }
          if (!ev.streamUrl) {
            ev.streamUrl = src.url;
            if (src.headers && Object.keys(src.headers).length > 0) ev.headers = src.headers;
          }
        }
        if (!ev.streamUrl) {
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
      if (body.headers && typeof body.headers === 'object') target.headers = body.headers as StreamHeaders;
      if (typeof body.homeScore === 'number') (target as { homeScore?: number }).homeScore = body.homeScore;
      if (typeof body.awayScore === 'number') (target as { awayScore?: number }).awayScore = body.awayScore;
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
