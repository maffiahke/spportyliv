import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  AdminBanner,
  AdminLiveEvent,
  AdminUpcomingEvent,
  AppData,
  DEFAULT_ADS_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  IptvChannel,
  IptvPlaylist,
  PushPrefs,
  SiteSettings,
} from '../src/types/iptv.js';
import { hasDatabase, loadSnapshot, persistSnapshot, prisma, readRevision } from './db.js';

export type { PushPrefs } from '../src/types/iptv.js';

/** A stored browser push subscription (admin console devices). */
export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  userAgent?: string;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/** A registered viewer account. Password is stored as a scrypt hash. */
export interface StoredUser {
  id: string;
  username: string;
  /** Lower-cased username for case-insensitive lookups. */
  usernameLower: string;
  country: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

/** A viewer session. Only a hash of the bearer token is persisted. */
export interface UserSessionRecord {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoreData {
  playlists: IptvPlaylist[];
  channels: IptvChannel[];
  liveEvents: AdminLiveEvent[];
  upcomingEvents: AdminUpcomingEvent[];
  banners: AdminBanner[];
  settings: SiteSettings;
  pushSubscriptions: PushSubscriptionRecord[];
  pushPrefs: PushPrefs;
  users: StoredUser[];
  userSessions: UserSessionRecord[];
  vapid?: VapidKeys;
}

/** Where the store is persisted: Neon Postgres, or the local JSON file. */
export type StoreBackend = 'neon' | 'json';

const DATA_DIR = resolve(process.cwd(), 'server', 'data');
const STORE_PATH = join(DATA_DIR, 'store.json');

const EMPTY: StoreData = {
  playlists: [],
  channels: [],
  liveEvents: [],
  // Only admin-managed fixtures are shown; a fresh store starts empty.
  upcomingEvents: [],
  banners: [],
  settings: { ...DEFAULT_SITE_SETTINGS },
  pushSubscriptions: [],
  pushPrefs: { newEvents: true, syncErrors: true, syncChanges: false },
  users: [],
  userSessions: [],
};

let cache: StoreData | null = null;
let initialized = false;
let revision = 0;
let initPromise: Promise<void> | null = null;
let persistChain: Promise<unknown> = Promise.resolve();
let lastPersisted: StoreData | null = null;
const listeners = new Set<(revision: number) => void>();

export function storeBackend(): StoreBackend {
  return hasDatabase ? 'neon' : 'json';
}

/** True on Vercel/Lambda, where the filesystem is read-only and ephemeral. */
export function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Older playlist syncs reused provider index ids, so a stored channel list can
 * hold two entries with the same id. That reaches the UI as duplicate React
 * keys. Rename later duplicates (the first keeps its id so event links stay
 * valid) and report whether anything changed so the healed list is persisted.
 */
function healDuplicateChannelIds(loaded: StoreData): boolean {
  let changed = false;
  const seen = new Set<string>();
  for (const c of loaded.channels) {
    if (!c.id) {
      c.id = makeId('ch');
      seen.add(c.id);
      changed = true;
      continue;
    }
    if (!seen.has(c.id)) {
      seen.add(c.id);
      continue;
    }
    const base = c.id;
    let n = 2;
    while (seen.has(`${base}-${n}`)) n++;
    c.id = `${base}-${n}`;
    seen.add(c.id);
    changed = true;
  }
  return changed;
}

function normalize(raw: Partial<StoreData>): StoreData {
  const loaded: StoreData = { ...structuredClone(EMPTY), ...raw };
  loaded.settings = { ...DEFAULT_SITE_SETTINGS, ...(loaded.settings ?? {}) };
  // Older stores predate the ads block: fill in every placement so the admin
  // console never has to guard against missing slot entries.
  loaded.settings.ads = {
    ...DEFAULT_ADS_SETTINGS,
    ...(loaded.settings.ads ?? {}),
    slots: { ...DEFAULT_ADS_SETTINGS.slots, ...(loaded.settings.ads?.slots ?? {}) },
  };
  loaded.pushSubscriptions = loaded.pushSubscriptions ?? [];
  loaded.pushPrefs = { ...EMPTY.pushPrefs, ...(loaded.pushPrefs ?? {}) };
  loaded.users = loaded.users ?? [];
  loaded.userSessions = loaded.userSessions ?? [];
  loaded.channels = loaded.channels ?? [];
  loaded.playlists = loaded.playlists ?? [];
  loaded.liveEvents = loaded.liveEvents ?? [];
  loaded.upcomingEvents = loaded.upcomingEvents ?? [];
  loaded.banners = loaded.banners ?? [];
  return loaded;
}

function readJsonStore(): StoreData | null {
  try {
    if (!existsSync(STORE_PATH)) return null;
    return normalize(JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as Partial<StoreData>);
  } catch (err) {
    console.error('[store] could not read server/data/store.json:', (err as Error).message);
    return null;
  }
}

function writeJsonStore(data: StoreData): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, STORE_PATH);
}

function emit(revisionNumber: number): void {
  for (const listener of listeners) {
    try {
      listener(revisionNumber);
    } catch (err) {
      console.error('[store] change listener failed:', (err as Error).message);
    }
  }
}

async function initStore(): Promise<void> {
  if (hasDatabase) {
    const snapshot = await loadSnapshot();
    if (!snapshot) throw new Error('DATABASE_URL is set but the Prisma client is unavailable');

    if (snapshot.initialized) {
      cache = snapshot.data;
      revision = snapshot.revision;
      // Keep a distinct copy: the diff in persistSnapshot relies on this not
      // sharing references with the mutable live cache (viewer sign-up pushes
      // into `store.users`, admin edits mutate nested objects).
      lastPersisted = structuredClone(snapshot.data);
      if (healDuplicateChannelIds(cache)) await saveStore();
    } else {
      // First boot against a fresh Neon database: carry the existing JSON store
      // (playlists, channels, accounts) over in one transaction.
      const legacy = readJsonStore();
      cache = normalize(legacy ?? structuredClone(EMPTY));
      revision = await persistSnapshot(cache, null);
      lastPersisted = structuredClone(cache);
      console.log(
        `[store] seeded Neon from ${legacy ? 'server/data/store.json' : 'built-in defaults'}: ` +
          `${cache.channels.length} channels, ${cache.playlists.length} playlists`,
      );
    }
    console.log(`[store] neon backend ready (revision ${revision})`);
    return;
  }

  cache = normalize(readJsonStore() ?? structuredClone(EMPTY));
  lastPersisted = cache;
  if (isServerlessRuntime()) {
    // Nothing here can be persisted: /var/task is read-only and /tmp dies with
    // the invocation. Fail loudly so the deployment gets fixed, not silently
    // loses admin edits.
    throw new Error(
      'DATABASE_URL is required on serverless hosts (Vercel): the JSON file store is not writable. ' +
        'Add the Neon connection string in Project → Settings → Environment Variables.'
    );
  }
  if (healDuplicateChannelIds(cache)) writeJsonStore(cache);
  console.warn('[store] DATABASE_URL is not set — falling back to server/data/store.json');
}

/**
 * Load the store once per process. Must be awaited before handling any request;
 * the rest of this module stays synchronous because it reads the in-memory cache.
 */
export function ensureStoreReady(): Promise<void> {
  if (initialized) return Promise.resolve();
  initPromise ??= initStore()
    .then(() => {
      initialized = true;
    })
    .catch((err) => {
      initPromise = null;
      throw err;
    });
  return initPromise;
}

export function loadStore(): StoreData {
  if (cache) return cache;
  // Pre-init callers get an empty shell; ensureStoreReady() has usually run.
  cache = normalize(structuredClone(EMPTY));
  return cache;
}

export function getStoreRevision(): number {
  return revision;
}

/** Subscribe to committed changes (local save or another instance's write). */
export function onStoreChange(listener: (revision: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Persist the current cache and bump the revision. Writes are serialized so
 * concurrent admin actions cannot interleave; each call snapshots the cache
 * immediately, so a later mutation can never corrupt an in-flight write.
 */
export function saveStore(): Promise<void> {
  if (!cache) return Promise.resolve();
  const snapshot = structuredClone(cache);
  const run = persistChain.then(async () => {
    if (hasDatabase) {
      revision = await persistSnapshot(snapshot, lastPersisted);
    } else {
      writeJsonStore(snapshot);
      revision += 1;
    }
    lastPersisted = snapshot;
    emit(revision);
  });
  // Keep the chain alive even if this write fails; the caller still sees it.
  persistChain = run.catch(() => undefined);
  return run;
}

/** Resolves when every queued write has landed. */
export function flushStore(): Promise<void> {
  return persistChain.then(() => undefined);
}

/**
 * Pull a newer snapshot written by another server instance. Returns true when
 * the local cache changed, so SSE handlers can notify their clients.
 */
export async function syncFromDatabase(): Promise<boolean> {
  if (!hasDatabase || !prisma) return false;
  const remoteRevision = await readRevision();
  if (remoteRevision <= revision) return false;
  const snapshot = await loadSnapshot();
  if (!snapshot || !snapshot.initialized) return false;
  cache = snapshot.data;
  lastPersisted = structuredClone(snapshot.data);
  revision = snapshot.revision;
  emit(revision);
  return true;
}

export function getAppData(includeDisabledPlaylistChannels = false): AppData {
  const store = loadStore();
  const includeAll = includeDisabledPlaylistChannels;
  const disabledPlaylistIds = includeAll
    ? new Set<string>()
    : new Set(
        store.playlists.filter((p) => p.enabled === false).map((p) => p.id)
      );
  return {
    playlists: store.playlists,
    // Public feed only exposes channels whose last post-sync probe returned
    // HTTP 200 (alive !== false; untested channels stay visible until the next
    // sync). The admin feed (includeAll) sees everything.
    channels: store.channels.filter(
      (c) =>
        !disabledPlaylistIds.has(c.playlistId) &&
        (includeAll || c.alive !== false)
    ),
    liveEvents: store.liveEvents,
    upcomingEvents: store.upcomingEvents,
    banners: store.banners,
    settings: store.settings,
  };
}

/** ID helper: safe, sortable-ish, unique per process tick. */
export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
