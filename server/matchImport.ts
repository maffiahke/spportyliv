/**
 * Match importer: turns match feeds (JSON or M3U) into admin-managed events.
 *
 * JSON shape (single object, array, or { matches: [...] }):
 *   category, event_name, team1, team2, logo1, logo2, date, time,
 *   start_timestamp_ms, description, meta_keywords,
 *   stream_ads: [{ title, quality, type, url, user_agent }]
 *
 * M3U shape: #EXTINF entries whose display name contains a "TEAM1 VS TEAM2"
 * pattern (e.g. "EN - EVERTON VS CHELSEA 12:30 CET"), one stream per entry.
 */
import type {
  AdminLiveEvent,
  AdminUpcomingEvent,
  MatchStream,
  StreamHeaders,
} from '../src/types/iptv.js';
import type { StoreData } from './store.js';
import { parseM3U } from '../src/lib/m3u.js';
import { makeId } from './store.js';

/** A normalized match awaiting import. */
export interface MatchImport {
  category?: string;
  league?: string;
  team1: string;
  team2: string;
  logo1?: string;
  logo2?: string;
  /** ISO yyyy-mm-dd, when known. */
  date?: string;
  /** Display time string as provided (e.g. "06:30 PM"). */
  time?: string;
  /** Absolute epoch ms — authoritative for live/upcoming classification. */
  startTimestampMs?: number;
  venue?: string;
  /** "UPCOMING" / "LIVE" style keyword from the feed. */
  statusKeyword?: string;
  /** Broadcast channels, shown as the fixture's "channel" label. */
  officialTv?: string[];
  /** League/competition badge (M3U tvg-logo). */
  leagueLogo?: string;
  streams: MatchStream[];
}

const TEAM_SPLIT_RE = /\s+(?:VS|V|VS\.|-)\s+/i;
const TIME_TAIL_RE = /\s+(\d{1,2}(?::\d{2})?)\s*(AM|PM)?(?:\s+([A-Z]{2,5}))?\s*$/i;
const LANG_PREFIX_RE = /^[A-Z]{2,5}\s+-\s+/;

/** Category words → sport ids (best-effort). */
function sportFromCategory(raw: string | undefined): AdminLiveEvent['sport'] {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('football') || v.includes('soccer')) return 'football';
  if (v.includes('basket')) return 'basketball';
  if (v.includes('tennis')) return 'tennis';
  if (v.includes('box')) return 'boxing';
  if (v.includes('formula') || v === 'f1') return 'f1';
  if (v.includes('cricket')) return 'cricket';
  if (v.includes('mma') || v.includes('ufc')) return 'mma';
  if (v.includes('golf')) return 'golf';
  return 'other';
}

function headersFromStream(ad: { user_agent?: string; referer?: string }): StreamHeaders {
  const out: StreamHeaders = {};
  if (ad.user_agent) out.userAgent = ad.user_agent;
  if (ad.referer) out.referer = ad.referer;
  return out;
}

/* ------------------------------- JSON input ------------------------------- */

/** Accepts an array, a single object, or `{ matches: [...] }` / `{ data: [...] }`. */
export function parseMatchesFromJson(value: unknown): MatchImport[] {
  let rows: unknown[] = [];
  if (Array.isArray(value)) rows = value;
  else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['matches', 'data', 'events', 'results']) {
      if (Array.isArray(obj[key])) {
        rows = obj[key] as unknown[];
        break;
      }
    }
    if (rows.length === 0 && typeof obj.team1 === 'string') rows = [value];
  }
  if (rows.length === 0) throw new Error('No match objects found in JSON (expected an array or { matches: [...] })');

  const out: MatchImport[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const str = (k: string): string | undefined => {
      const v = r[k];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const team1 = str('team1') ?? str('home') ?? str('home_team');
    const team2 = str('team2') ?? str('away') ?? str('away_team');
    if (!team1 || !team2) continue;

    const ads = Array.isArray(r.stream_ads) ? r.stream_ads : Array.isArray(r.streams) ? r.streams : [];
    const streams: MatchStream[] = [];
    for (const ad of ads) {
      if (!ad || typeof ad !== 'object') continue;
      const a = ad as Record<string, unknown>;
      const url = typeof a.url === 'string' ? a.url.trim() : '';
      if (!url) continue;
      streams.push({
        title: typeof a.title === 'string' ? a.title : undefined,
        quality: typeof a.quality === 'string' ? a.quality : undefined,
        url,
        userAgent: typeof a.user_agent === 'string' ? a.user_agent : undefined,
        referer: typeof a.referer === 'string' ? a.referer : undefined,
      });
    }

    const ts = Number(r.start_timestamp_ms);
    out.push({
      category: str('category'),
      league: str('event_name') ?? str('league'),
      team1,
      team2,
      logo1: str('logo1') ?? str('home_logo'),
      logo2: str('logo2') ?? str('away_logo'),
      date: str('date'),
      time: str('time'),
      startTimestampMs: Number.isFinite(ts) && ts > 0 ? ts : undefined,
      venue: str('description') ?? str('venue'),
      statusKeyword: str('meta_keywords') ?? str('status'),
      officialTv: Array.isArray(r.official_tv)
        ? (r.official_tv as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
      streams,
    });
  }
  if (out.length === 0) throw new Error('No valid matches found in JSON (team1/team2 missing on every row)');
  return out;
}

/* -------------------------------- M3U input -------------------------------- */

/** Parse `#EXTINF` entries that look like fixtures ("A VS B 12:30 CET"). */
export function parseMatchesFromM3U(text: string): MatchImport[] {
  const parsed = parseM3U(text);
  const out: MatchImport[] = [];
  for (const entry of parsed) {
    let name = entry.name.trim();
    if (LANG_PREFIX_RE.test(name)) name = name.replace(LANG_PREFIX_RE, '').trim();

    // Tail time (and optional timezone code) before the team split.
    let time: string | undefined;
    const tail = name.match(TIME_TAIL_RE);
    if (tail) {
      time = `${tail[1]}${tail[2] ? ` ${tail[2].toUpperCase()}` : ''}`;
      name = name.slice(0, tail.index).trim();
    }

    const vsMatch = name.match(TEAM_SPLIT_RE);
    if (!vsMatch || !vsMatch.index) continue;
    const team1 = name.slice(0, vsMatch.index).trim();
    const team2 = name.slice(vsMatch.index + vsMatch[0].length).trim();
    if (!team1 || !team2 || team1.length > 40 || team2.length > 40) continue;

    out.push({
      category: entry.group,
      league: entry.group,
      team1,
      team2,
      time,
      leagueLogo: entry.tvgLogo,
      streams: entry.url
        ? [{ title: entry.name, quality: undefined, url: entry.url, userAgent: entry.headers.userAgent, referer: entry.headers.referer }]
        : [],
    });
  }
  if (out.length === 0) throw new Error('No match entries found in M3U (names must contain "TEAM1 VS TEAM2")');
  return out;
}

/* ------------------------------- Into the store ------------------------------- */

/** A match still inside this window after kickoff counts as live. */
const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** true → live event; false → upcoming fixture. */
function isLiveMatch(m: MatchImport): boolean {
  const kw = (m.statusKeyword ?? '').toUpperCase();
  if (kw.includes('LIVE') && !kw.includes('UPCOMING')) return true;
  if (m.startTimestampMs) return m.startTimestampMs <= Date.now();
  return false;
}

/** True when the match kicked off more than 2 hours ago — past the live window. */
function isEndedMatch(m: MatchImport): boolean {
  return Boolean(m.startTimestampMs && Date.now() - m.startTimestampMs > LIVE_WINDOW_MS);
}

function dedupeKey(m: MatchImport): string {
  return `${m.team1.trim().toLowerCase()}|${m.team2.trim().toLowerCase()}|${m.date ?? ''}`;
}

function streamsOf(m: MatchImport): MatchStream[] {
  // Collapse duplicates by URL while keeping order.
  const seen = new Set<string>();
  return m.streams.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

export interface MatchImportResult {
  liveCreated: number;
  upcomingCreated: number;
  updated: number;
  skipped: number;
}

/** Upsert parsed matches into the store's live + upcoming events. */
export function importMatchesIntoStore(
  store: StoreData,
  matches: MatchImport[],
): MatchImportResult {
  const result: MatchImportResult = { liveCreated: 0, upcomingCreated: 0, updated: 0, skipped: 0 };
  const seenInBatch = new Set<string>();

  for (const m of matches) {
    const key = dedupeKey(m);
    if (seenInBatch.has(key)) {
      result.skipped++;
      continue;
    }
    seenInBatch.add(key);
    if (isEndedMatch(m)) {
      // More than 2 hours past kickoff — nothing left to show.
      result.skipped++;
      continue;
    }

    const streams = streamsOf(m);
    const primary = streams[0];
    const channelLabel = (m.officialTv?.length ? m.officialTv.join(', ') : m.league) || 'TBD';
    const league = m.league || m.category || 'Friendly';
    const dateKey = m.date ?? new Date().toISOString().slice(0, 10);
    const time = m.time ?? '';
    const live = isLiveMatch(m);

    // Re-import: refresh the existing event with the same teams + date instead
    // of duplicating it.
    const existingLive = store.liveEvents.find(
      (e) =>
        e.homeTeam.trim().toLowerCase() === m.team1.trim().toLowerCase() &&
        e.awayTeam.trim().toLowerCase() === m.team2.trim().toLowerCase() &&
        (e.dateKey ?? '') === dateKey,
    );
    const existingUpcoming = store.upcomingEvents.find(
      (e) =>
        e.homeTeam.trim().toLowerCase() === m.team1.trim().toLowerCase() &&
        e.awayTeam.trim().toLowerCase() === m.team2.trim().toLowerCase() &&
        (e.dateKey ?? '') === dateKey,
    );

    if (live) {
      if (existingLive) {
        existingLive.streamUrl = primary?.url ?? existingLive.streamUrl ?? '';
        existingLive.customStreams = []; // imports attach only the primary stream
        existingLive.league = league;
        existingLive.venue = m.venue ?? existingLive.venue;
        existingLive.homeLogoUrl = m.logo1 ?? existingLive.homeLogoUrl;
        existingLive.awayLogoUrl = m.logo2 ?? existingLive.awayLogoUrl;
        existingLive.time = time || existingLive.time;
        existingLive.startTimestampMs = m.startTimestampMs;
        existingLive.status = isLiveMatch(m) ? 'live' : 'upcoming';
        // Leave enabled untouched on re-import updates.
        result.updated++;
        continue;
      }
      if (existingUpcoming) {
        // Kickoff arrived since import: promote the fixture to a live event.
        store.upcomingEvents = store.upcomingEvents.filter((e) => e.id !== existingUpcoming.id);
      }
      const ev: AdminLiveEvent = {
        id: makeId('lvev'),
        homeTeam: m.team1,
        awayTeam: m.team2,
        sport: sportFromCategory(m.category),
        league,
        venue: m.venue ?? '',
        homeScore: 0,
        awayScore: 0,
        quality: primary?.quality === '4K' ? '4K' : 'HD',
        streamUrl: primary?.url ?? '',
        headers: headersFromStream(primary ?? {}),
        homeLogoUrl: m.logo1,
        awayLogoUrl: m.logo2,
        status: 'live',
        startTimestampMs: m.startTimestampMs,
        dateKey,
        time,
        // Imported entries start disabled: the admin reviews and enables them.
        enabled: false,
      };
      store.liveEvents.unshift(ev);
      result.liveCreated++;
      continue;
    }

    // Upcoming fixture.
    if (existingUpcoming) {
      existingUpcoming.streamUrl = primary?.url ?? existingUpcoming.streamUrl;
      existingUpcoming.customStreams = []; // imports attach only the primary stream
      existingUpcoming.league = league;
      existingUpcoming.channel = channelLabel;
      existingUpcoming.homeTeam = m.team1;
      existingUpcoming.awayTeam = m.team2;
      existingUpcoming.homeLogoUrl = m.logo1 ?? existingUpcoming.homeLogoUrl;
      existingUpcoming.awayLogoUrl = m.logo2 ?? existingUpcoming.awayLogoUrl;
      existingUpcoming.leagueLogo = m.leagueLogo ?? existingUpcoming.leagueLogo;
      existingUpcoming.time = time || existingUpcoming.time;
      existingUpcoming.status = 'upcoming';
      existingUpcoming.startTimestampMs = m.startTimestampMs;
      // Leave enabled untouched on re-import updates.
      result.updated++;
      continue;
    }
    if (existingLive) {
      // The feed moved the fixture back to upcoming — trust the feed.
      store.liveEvents = store.liveEvents.filter((e) => e.id !== existingLive.id);
    }
    const ev: AdminUpcomingEvent = {
      id: makeId('upev'),
      homeTeam: m.team1,
      awayTeam: m.team2,
      sport: sportFromCategory(m.category),
      league,
      channel: channelLabel,
      homeLogoUrl: m.logo1,
      awayLogoUrl: m.logo2,
      leagueLogo: m.leagueLogo,
      dateKey,
      time,
      streamUrl: primary?.url,
      headers: headersFromStream(primary ?? {}),
      status: 'upcoming',
      startTimestampMs: m.startTimestampMs,
      // Imported entries start disabled: the admin reviews and enables them.
      enabled: false,
    };
    store.upcomingEvents.unshift(ev);
    result.upcomingCreated++;
  }

  return result;
}

/** Detect the feed format: M3U lines start with '#EXTM3U'/'#EXTINF'. */
export function detectMatchFormat(text: string): 'json' | 'm3u' {
  const head = text.slice(0, 2000).trimStart();
  if (head.startsWith('{') || head.startsWith('[')) return 'json';
  if (/^#EXTM3U|^\s*#EXTINF/im.test(head)) return 'm3u';
  // Fallback: try JSON first (will throw a clear error if it is neither).
  return 'json';
}
