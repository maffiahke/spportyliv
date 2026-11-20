import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import type {
  AdminBanner,
  AdminLiveEvent,
  AdminUpcomingEvent,
  IptvChannel,
  IptvPlaylist,
  SiteSettings,
  StreamHeaders,
} from '../src/types/iptv';
import { DEFAULT_ADS_SETTINGS, DEFAULT_SITE_SETTINGS } from '../src/types/iptv';
import type {
  PushSubscriptionRecord,
  StoredUser,
  StoreData,
  UserSessionRecord,
  VapidKeys,
} from './store';

/** True when a Neon/Postgres connection string is configured. */
export const DATABASE_URL = (process.env.DATABASE_URL ?? '').trim();
export const hasDatabase = /^postgres(ql)?:\/\//i.test(DATABASE_URL);

// Reuse one client across Vite config reloads, otherwise each hot reload would
// leak a connection pool.
const globalForPrisma = globalThis as unknown as { sportyPrisma?: PrismaClient };
export const prisma: PrismaClient | null = hasDatabase
  ? globalForPrisma.sportyPrisma ??
    new PrismaClient({
      datasourceUrl: DATABASE_URL,
      log: ['warn', 'error'],
    })
  : null;
if (hasDatabase && prisma) globalForPrisma.sportyPrisma = prisma;

export interface StoreSnapshot {
  data: StoreData;
  revision: number;
  /** False when the tables have never been written (fresh Neon project). */
  initialized: boolean;
}

function headersOf(value: unknown): StreamHeaders {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as StreamHeaders)
    : {};
}

/* ------------------------------ row <-> model ------------------------------ */

type ChannelRow = Prisma.ChannelGetPayload<{}>;
type PlaylistRow = Prisma.PlaylistGetPayload<{}>;
type LiveEventRow = Prisma.LiveEventGetPayload<{}>;
type UpcomingEventRow = Prisma.UpcomingEventGetPayload<{}>;
type BannerRow = Prisma.BannerGetPayload<{}>;
type ViewerRow = Prisma.ViewerGetPayload<{}>;
type SessionRow = Prisma.UserSessionGetPayload<{}>;
type PushSubscriptionRow = Prisma.PushSubscriptionGetPayload<{}>;

function channelRecord(c: IptvChannel) {
  return {
    id: c.id,
    playlistId: c.playlistId,
    name: c.name,
    group: c.group ?? null,
    tvgId: c.tvgId ?? null,
    tvgLogo: c.tvgLogo ?? null,
    url: c.url,
    headers: (c.headers ?? {}) as Prisma.InputJsonValue,
    sport: c.sport,
    shelf: c.shelf,
    quality: c.quality,
    enabled: c.enabled !== false,
  };
}

const channelFromRow = (r: ChannelRow): IptvChannel => ({
  id: r.id,
  playlistId: r.playlistId,
  name: r.name,
  group: r.group ?? undefined,
  tvgId: r.tvgId ?? undefined,
  tvgLogo: r.tvgLogo ?? undefined,
  url: r.url,
  headers: headersOf(r.headers),
  sport: r.sport as IptvChannel['sport'],
  shelf: r.shelf as IptvChannel['shelf'],
  quality: r.quality as IptvChannel['quality'],
  enabled: r.enabled,
});

function playlistRecord(p: IptvPlaylist) {
  return {
    id: p.id,
    name: p.name,
    sourceUrl: p.sourceUrl ?? null,
    sourceContent: p.sourceContent ?? null,
    channelCount: p.channelCount ?? 0,
    importedAt: p.importedAt ?? '',
    lastRefreshedAt: p.lastRefreshedAt ?? null,
    autoSync: p.autoSync ?? null,
    enabled: p.enabled ?? null,
    lastSyncedAt: p.lastSyncedAt ?? null,
    lastError: p.lastError ?? null,
  };
}

const playlistFromRow = (r: PlaylistRow): IptvPlaylist => ({
  id: r.id,
  name: r.name,
  sourceUrl: r.sourceUrl ?? undefined,
  sourceContent: r.sourceContent ?? undefined,
  channelCount: r.channelCount,
  importedAt: r.importedAt,
  lastRefreshedAt: r.lastRefreshedAt ?? undefined,
  autoSync: r.autoSync ?? undefined,
  enabled: r.enabled ?? undefined,
  lastSyncedAt: r.lastSyncedAt ?? undefined,
  lastError: r.lastError ?? undefined,
});

function liveEventRecord(e: AdminLiveEvent) {
  return {
    id: e.id,
    homeTeam: e.homeTeam,
    awayTeam: e.awayTeam,
    sport: e.sport,
    league: e.league,
    venue: e.venue ?? '',
    homeScore: e.homeScore ?? 0,
    awayScore: e.awayScore ?? 0,
    statusLabel: e.statusLabel ?? null,
    viewers: e.viewers ?? null,
    quality: e.quality,
    streamUrl: e.streamUrl ?? '',
    headers: (e.headers ?? {}) as Prisma.InputJsonValue,
    homeLogoUrl: e.homeLogoUrl ?? null,
    awayLogoUrl: e.awayLogoUrl ?? null,
    channelId: e.channelId ?? null,
    status: e.status ?? null,
    dateKey: e.dateKey ?? null,
    time: e.time ?? null,
    enabled: e.enabled !== false,
  };
}

const liveEventFromRow = (r: LiveEventRow): AdminLiveEvent => ({
  id: r.id,
  homeTeam: r.homeTeam,
  awayTeam: r.awayTeam,
  sport: r.sport as AdminLiveEvent['sport'],
  league: r.league,
  venue: r.venue,
  homeScore: r.homeScore,
  awayScore: r.awayScore,
  statusLabel: r.statusLabel ?? undefined,
  viewers: r.viewers ?? undefined,
  quality: r.quality as AdminLiveEvent['quality'],
  streamUrl: r.streamUrl,
  headers: headersOf(r.headers),
  homeLogoUrl: r.homeLogoUrl ?? undefined,
  awayLogoUrl: r.awayLogoUrl ?? undefined,
  channelId: r.channelId ?? undefined,
  status: (r.status as AdminLiveEvent['status']) ?? undefined,
  dateKey: r.dateKey ?? undefined,
  time: r.time ?? undefined,
  enabled: r.enabled,
});

function upcomingEventRecord(e: AdminUpcomingEvent) {
  return {
    id: e.id,
    homeTeam: e.homeTeam,
    awayTeam: e.awayTeam,
    sport: e.sport,
    league: e.league,
    channel: e.channel ?? '',
    dateKey: e.dateKey ?? '',
    time: e.time ?? '',
    streamUrl: e.streamUrl ?? null,
    headers: (e.headers ?? {}) as Prisma.InputJsonValue,
    status: e.status ?? null,
    enabled: e.enabled !== false,
  };
}

const upcomingEventFromRow = (r: UpcomingEventRow): AdminUpcomingEvent => ({
  id: r.id,
  homeTeam: r.homeTeam,
  awayTeam: r.awayTeam,
  sport: r.sport as AdminUpcomingEvent['sport'],
  league: r.league,
  channel: r.channel,
  dateKey: r.dateKey,
  time: r.time,
  streamUrl: r.streamUrl ?? undefined,
  headers: headersOf(r.headers),
  status: (r.status as AdminUpcomingEvent['status']) ?? undefined,
  enabled: r.enabled,
});

function bannerRecord(b: AdminBanner) {
  return {
    id: b.id,
    sport: b.sport,
    headlineTop: b.headlineTop ?? '',
    headlineHighlight: b.headlineHighlight ?? '',
    headlineBottom: b.headlineBottom ?? '',
    subtitleLine1: b.subtitleLine1 ?? '',
    subtitleLine2: b.subtitleLine2 ?? '',
    ctaLabel: b.ctaLabel ?? '',
    bgGradient: b.bgGradient ?? '',
    imageUrl: b.imageUrl ?? null,
    targetEventId: b.targetEventId ?? null,
    enabled: b.enabled !== false,
  };
}

const bannerFromRow = (r: BannerRow): AdminBanner => ({
  id: r.id,
  sport: r.sport as AdminBanner['sport'],
  headlineTop: r.headlineTop,
  headlineHighlight: r.headlineHighlight,
  headlineBottom: r.headlineBottom,
  subtitleLine1: r.subtitleLine1,
  subtitleLine2: r.subtitleLine2,
  ctaLabel: r.ctaLabel,
  bgGradient: r.bgGradient,
  imageUrl: r.imageUrl ?? undefined,
  targetEventId: r.targetEventId ?? undefined,
  enabled: r.enabled,
});

function viewerRecord(u: StoredUser) {
  return {
    id: u.id,
    username: u.username,
    usernameLower: u.usernameLower,
    country: u.country ?? '',
    passwordHash: u.passwordHash,
    passwordSalt: u.passwordSalt,
    createdAt: u.createdAt,
  };
}

const viewerFromRow = (r: ViewerRow): StoredUser => ({
  id: r.id,
  username: r.username,
  usernameLower: r.usernameLower,
  country: r.country,
  passwordHash: r.passwordHash,
  passwordSalt: r.passwordSalt,
  createdAt: r.createdAt,
});

function sessionRecord(s: UserSessionRecord) {
  return {
    tokenHash: s.tokenHash,
    userId: s.userId,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  };
}

const sessionFromRow = (r: SessionRow): UserSessionRecord => ({
  tokenHash: r.tokenHash,
  userId: r.userId,
  createdAt: r.createdAt,
  expiresAt: r.expiresAt,
});

function pushRecord(p: PushSubscriptionRecord) {
  return {
    id: p.id,
    endpoint: p.endpoint,
    p256dh: p.keys?.p256dh ?? '',
    auth: p.keys?.auth ?? '',
    createdAt: p.createdAt,
    userAgent: p.userAgent ?? null,
  };
}

const pushFromRow = (r: PushSubscriptionRow): PushSubscriptionRecord => ({
  id: r.id,
  endpoint: r.endpoint,
  keys: { p256dh: r.p256dh, auth: r.auth },
  createdAt: r.createdAt,
  userAgent: r.userAgent ?? undefined,
});

/* -------------------------------- snapshot -------------------------------- */

export async function loadSnapshot(): Promise<StoreSnapshot | null> {
  if (!prisma) return null;
  const [meta, playlists, channels, liveEvents, upcomingEvents, banners, docs, viewers, sessions, pushSubs] =
    await Promise.all([
      prisma.storeMeta.findUnique({ where: { id: 1 } }),
      prisma.playlist.findMany(),
      prisma.channel.findMany(),
      prisma.liveEvent.findMany(),
      prisma.upcomingEvent.findMany(),
      prisma.banner.findMany(),
      prisma.settingDoc.findMany(),
      prisma.viewer.findMany(),
      prisma.userSession.findMany(),
      prisma.pushSubscription.findMany(),
    ]);

  const docMap = new Map(docs.map((d) => [d.key, d.value]));
  const pushPrefs = docMap.get('pushPrefs');
  const data: StoreData = {
    playlists: playlists.map(playlistFromRow),
    channels: channels.map(channelFromRow),
    liveEvents: liveEvents.map(liveEventFromRow),
    upcomingEvents: upcomingEvents.map(upcomingEventFromRow),
    banners: banners.map(bannerFromRow),
    settings: {
      ...DEFAULT_SITE_SETTINGS,
      ...((docMap.get('settings') as Partial<SiteSettings> | undefined) ?? {}),
      ads: {
        ...DEFAULT_ADS_SETTINGS,
        ...(((docMap.get('settings') as Partial<SiteSettings> | undefined)?.ads) ?? {}),
        slots: {
          ...DEFAULT_ADS_SETTINGS.slots,
          ...(((docMap.get('settings') as Partial<SiteSettings> | undefined)?.ads?.slots) ?? {}),
        },
      },
    },
    pushSubscriptions: pushSubs.map(pushFromRow),
    pushPrefs: (pushPrefs as StoreData['pushPrefs'] | undefined) ?? {
      newEvents: true,
      syncErrors: true,
      syncChanges: false,
    },
    users: viewers.map(viewerFromRow),
    userSessions: sessions.map(sessionFromRow),
    vapid: (docMap.get('vapid') as VapidKeys | undefined) ?? undefined,
  };

  return { data, revision: meta?.revision ?? 0, initialized: meta !== null };
}

/** Cheap change detection for SSE clients across server instances. */
export async function readRevision(): Promise<number> {
  if (!prisma) return 0;
  const meta = await prisma.storeMeta.findUnique({ where: { id: 1 }, select: { revision: true } });
  return meta?.revision ?? 0;
}

/**
 * Commit the whole store in one transaction and bump the revision.
 *
 * Only rows whose values changed are written (the previous snapshot is the
 * in-memory cache, so admin edits are one-row upserts while a fresh playlist
 * import is a bulk insert), keeping Neon round-trips proportional to the edit
 * rather than to the channel count.
 */
export async function persistSnapshot(
  data: StoreData,
  previous: StoreData | null,
): Promise<number> {
  if (!prisma) return 0;

  type Op = (tx: Prisma.TransactionClient) => Promise<unknown>;
  const ops: Op[] = [];

  const list = <T>(next: T[], prev: T[], key: (item: T) => string): { add: T[]; change: T[]; removed: string[] } => {
    const prevByKey = new Map(prev.map((item) => [key(item), item]));
    const nextKeys = new Set(next.map(key));
    const add: T[] = [];
    const change: T[] = [];
    for (const item of next) {
      const k = key(item);
      const old = prevByKey.get(k);
      if (!old) add.push(item);
      else if (JSON.stringify(old) !== JSON.stringify(item)) change.push(item);
    }
    const removed = [...prevByKey.keys()].filter((k) => !nextKeys.has(k));
    return { add, change, removed };
  };

  const deleteMany = (
    ids: string[],
    run: (tx: Prisma.TransactionClient, ids: string[]) => Promise<unknown>,
  ): void => {
    if (ids.length === 0) return;
    ops.push((tx) => run(tx, ids));
  };

  /* playlists (parents) */
  const p = list(data.playlists, previous?.playlists ?? [], (x) => x.id);
  for (const row of [...p.add, ...p.change]) {
    const rec = playlistRecord(row);
    ops.push((tx) => tx.playlist.upsert({ where: { id: row.id }, create: rec, update: rec }));
  }


  /* channels */
  const c = list(data.channels, previous?.channels ?? [], (x) => x.id);
  for (const row of [...c.add, ...c.change]) {
    const rec = channelRecord(row);
    ops.push((tx) => tx.channel.upsert({ where: { id: row.id }, create: rec, update: rec }));
  }


  /* events */
  const l = list(data.liveEvents, previous?.liveEvents ?? [], (x) => x.id);
  for (const row of [...l.add, ...l.change]) {
    const rec = liveEventRecord(row);
    ops.push((tx) => tx.liveEvent.upsert({ where: { id: row.id }, create: rec, update: rec }));
  }


  const u = list(data.upcomingEvents, previous?.upcomingEvents ?? [], (x) => x.id);
  for (const row of [...u.add, ...u.change]) {
    const rec = upcomingEventRecord(row);
    ops.push((tx) => tx.upcomingEvent.upsert({ where: { id: row.id }, create: rec, update: rec }));
  }


  /* banners */
  const b = list(data.banners, previous?.banners ?? [], (x) => x.id);
  for (const row of [...b.add, ...b.change]) {
    const rec = bannerRecord(row);
    ops.push((tx) => tx.banner.upsert({ where: { id: row.id }, create: rec, update: rec }));
  }


  /* users + sessions (session first on delete, user after) */
  const s = list(data.userSessions, previous?.userSessions ?? [], (x) => x.tokenHash);
  for (const row of [...s.add, ...s.change]) {
    const rec = sessionRecord(row);
    ops.push((tx) => tx.userSession.upsert({ where: { tokenHash: row.tokenHash }, create: rec, update: rec }));
  }


  const v = list(data.users, previous?.users ?? [], (x) => x.id);
  for (const row of [...v.add, ...v.change]) {
    const rec = viewerRecord(row);
    ops.push((tx) => tx.viewer.upsert({ where: { id: row.id }, create: rec, update: rec }));
  }


  /* push subscriptions */
  const ps = list(data.pushSubscriptions, previous?.pushSubscriptions ?? [], (x) => x.id);
  for (const row of [...ps.add, ...ps.change]) {
    const rec = pushRecord(row);
    ops.push((tx) => tx.pushSubscription.upsert({ where: { id: row.id }, create: rec, update: rec }));
  }


  /* singleton documents */
  const docs: Array<[string, unknown]> = [
    ['settings', data.settings ?? {}],
    ['pushPrefs', data.pushPrefs ?? {}],
  ];
  if (data.vapid) docs.push(['vapid', data.vapid]);
  for (const [key, value] of docs) {
    const prevValue = previous
      ? key === 'settings'
        ? previous.settings
        : key === 'pushPrefs'
          ? previous.pushPrefs
          : previous.vapid
      : undefined;
    if (JSON.stringify(prevValue) === JSON.stringify(value)) continue;
    const json = value as Prisma.InputJsonValue;
    ops.push((tx) => tx.settingDoc.upsert({ where: { key }, create: { key, value: json }, update: { value: json } }));
  }

  /* deletions last: children before parents */
  deleteMany(c.removed, (tx, ids) => tx.channel.deleteMany({ where: { id: { in: ids } } }));
  deleteMany(p.removed, (tx, ids) => tx.playlist.deleteMany({ where: { id: { in: ids } } }));
  deleteMany(l.removed, (tx, ids) => tx.liveEvent.deleteMany({ where: { id: { in: ids } } }));
  deleteMany(u.removed, (tx, ids) => tx.upcomingEvent.deleteMany({ where: { id: { in: ids } } }));
  deleteMany(b.removed, (tx, ids) => tx.banner.deleteMany({ where: { id: { in: ids } } }));
  deleteMany(s.removed, (tx, ids) => tx.userSession.deleteMany({ where: { tokenHash: { in: ids } } }));
  deleteMany(v.removed, (tx, ids) => tx.viewer.deleteMany({ where: { id: { in: ids } } }));
  deleteMany(ps.removed, (tx, ids) => tx.pushSubscription.deleteMany({ where: { id: { in: ids } } }));

  const meta = await prisma.$transaction(
    async (tx) => {
      if (ops.length > 0) {
        // Create-only rows land before deletions so parents outlive children.
        for (const op of ops) await op(tx);
      }
      const now = new Date();
      return tx.storeMeta.upsert({
        where: { id: 1 },
        create: { id: 1, revision: 1, updatedAt: now },
        update: { revision: { increment: 1 } },
      });
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  return meta.revision;
}
