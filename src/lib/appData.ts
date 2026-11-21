import { buildProxiedUrl, isHlsUrl } from './proxy';
import { shortCode } from './m3u';
import {
  AdminEventStatus,
  AdminLiveEvent,
  AdminUpcomingEvent,
  AppData,
  DEFAULT_SITE_SETTINGS,
  IptvChannel,
  MatchStream,
  SiteSettings,
  StreamHeaders,
} from '../types/iptv';
import {
  HeroSlide,
  LiveMatch,
  TVChannel,
  UpcomingEvent,
} from '../types/sports';

/** Sport-tinted arena themes for dynamic IPTV events. */
const SPORT_THEMES: Record<string, [string, string]> = {
  football: ['#0A369D', '#8E0E42'],
  basketball: ['#4C1D95', '#065F46'],
  tennis: ['#065F46', '#1E3A8A'],
  boxing: ['#7F1D1D', '#1E293B'],
  f1: ['#1E1B4B', '#991B1B'],
  cricket: ['#0369A1', '#134E4A'],
  mma: ['#312E81', '#0F172A'],
  golf: ['#14532D', '#065F46'],
  other: ['#1E293B', '#334155'],
};

/** StreamHeaders for an imported match stream. */
function headersFromMatchStream(s: MatchStream): StreamHeaders {
  const out: StreamHeaders = {};
  if (s.userAgent) out.userAgent = s.userAgent;
  if (s.referer) out.referer = s.referer;
  return out;
}

/** Exact kickoff epoch for an event: feed timestamp first, date+time fallback. */
export function eventStartMs(ev: {
  startTimestampMs?: number;
  dateKey?: string;
  time?: string;
}): number | null {
  if (ev.startTimestampMs && ev.startTimestampMs > 0) return ev.startTimestampMs;
  const kickoff = parseKickoff(ev.dateKey, ev.time);
  return kickoff ? kickoff.getTime() : null;
}

/**
 * Kickoff as a local Date. Imported feeds carry the exact timestamp, so that
 * wins; the raw `time` string is in the FEED's timezone (e.g. Asia/Dhaka) and
 * must not be read as the viewer's local time when a timestamp exists.
 */
export function eventKickoffDate(ev: {
  startTimestampMs?: number;
  dateKey?: string;
  time?: string;
}): Date | null {
  if (ev.startTimestampMs && ev.startTimestampMs > 0) return new Date(ev.startTimestampMs);
  return parseKickoff(ev.dateKey, ev.time);
}

/**
 * Time-based status:
 *  - started and within 2h of kickoff → live
 *  - started more than 2h ago → ended
 *  - future within the upcoming window → upcoming
 *  - future beyond it → scheduled
 * Falls back to the stored status when the event carries no time information.
 */
export function computeEventStatus(
  ev: { startTimestampMs?: number; dateKey?: string; time?: string; status?: AdminEventStatus },
  fallback: AdminEventStatus = 'scheduled',
): AdminEventStatus {
  const start = eventStartMs(ev);
  if (start === null) return ev.status ?? fallback;
  const delta = start - Date.now();
  if (delta > 0) return delta <= UPCOMING_WINDOW_MS ? 'upcoming' : 'scheduled';
  return -delta <= LIVE_WINDOW_MS ? 'live' : 'ended';
}

export function adminEventToLiveMatch(
  ev: AdminLiveEvent,
  channels: IptvChannel[] = [],
): LiveMatch {
  const [leftTheme, rightTheme] = SPORT_THEMES[ev.sport] ?? SPORT_THEMES.other;

  // Ordered failover sources: every referenced channel (auto-sync aware, each
  // keeping its own headers), then any custom stream URL. Duplicates collapse.
  const sourceIds = [
    ...(ev.channelIds ?? []),
    ...(ev.channelId && !(ev.channelIds ?? []).includes(ev.channelId) ? [ev.channelId] : []),
  ];
  const seenUrls = new Set<string>();
  const streams: NonNullable<LiveMatch['streams']> = [];
  const pushSource = (url: string, label: string, headers: StreamHeaders, id: string, quality?: string): void => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    streams.push({
      id,
      label: quality ? `${label} · ${quality}` : label,
      url: url.startsWith('/api/iptv/stream') ? url : buildProxiedUrl(url, headers, isHlsUrl(url)),
    });
  };
  for (const cid of sourceIds) {
    const ch = channels.find((c) => c.id === cid);
    if (ch) pushSource(ch.url, ch.name, ch.headers, `ch-${ch.id}`);
  }
  for (const [i, s] of (ev.customStreams ?? []).entries()) {
    pushSource(s.url, s.title || `Stream ${i + 1}`, headersFromMatchStream(s), `cs-${i}`, s.quality);
  }
  const streamUrl = streams[0]?.url ?? '';
  return {
    id: `iptv-ev-${ev.id}`,
    sport: ev.sport,
    homeTeam: ev.homeTeam,
    awayTeam: ev.awayTeam,
    homeCrest: ev.homeLogoUrl || ev.homeTeam,
    awayCrest: ev.awayLogoUrl || ev.awayTeam,
    homeScore: ev.homeScore,
    awayScore: ev.awayScore,
    league: ev.league,
    leagueCrest: ev.league,
    elapsedSeconds: 0,
    statusLabel:
      ev.statusLabel ??
      (() => {
        const st = computeEventStatus(ev, ev.status ?? 'live');
        switch (st) {
          case 'ended':
            return 'ENDED';
          case 'upcoming':
            return 'UPCOMING';
          case 'scheduled':
            return 'SCHEDULED';
          default:
            return undefined;
        }
      })(),
    quality: ev.quality,
    viewers: ev.viewers || '—',
    videoUrl: streamUrl,
    streams,
    leftTheme,
    rightTheme,
    venue: ev.venue || `${ev.league} Live`,
    stats: [],
    commentary: [],
  };
}

export function iptvChannelToTVChannel(c: IptvChannel): TVChannel {
  return {
    id: `iptv-ch-${c.id}`,
    name: c.name,
    shortCode: shortCode(c.name),
    sport: c.sport === 'other' ? 'other' : c.sport,
    shelf: c.shelf,
    // IPTV channels use their own stream directly rather than a linked match badge.
    currentShow: c.group ? `${c.group}` : 'Live IPTV Feed',
    nextShow: 'Programmed by provider',
    quality: c.quality,
    viewers: '—',
    accentGradient: 'linear-gradient(135deg, #4C1D95 0%, #DB2777 100%)',
    streamUrl: c.url.startsWith('/api/iptv/stream')
      ? c.url
      : buildProxiedUrl(c.url, c.headers, isHlsUrl(c.url)),
    logoUrl: c.tvgLogo,
  } as TVChannel;
}

export function adminUpcomingToUpcomingEvent(ev: AdminUpcomingEvent): UpcomingEvent {
  // Imported feeds carry the exact kickoff: derive the calendar label from the
  // timestamp in the VIEWER's timezone (the raw `time` is the feed's timezone).
  const kickoff = eventKickoffDate(ev);
  const date = kickoff ?? new Date(`${ev.dateKey}T12:00:00`);
  const dayOfWeek = ev.dateKey
    ? ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]
    : '';
  const dayNumber = ev.dateKey ? String(date.getDate()).padStart(2, '0') : '';
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getMonth()];
  return {
    id: `iptv-up-${ev.id}`,
    sport: ev.sport,
    dayOfWeek,
    dayNumber,
    month,
    dateKey: ev.dateKey,
    homeTeam: ev.homeTeam,
    awayTeam: ev.awayTeam,
    homeCrest: ev.homeLogoUrl || ev.homeTeam,
    awayCrest: ev.awayLogoUrl || ev.awayTeam,
    time:
      kickoff && ev.startTimestampMs
        ? kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : ev.time,
    league: ev.league,
    leagueCrest: ev.leagueLogo || ev.league,
    channel: ev.channel,
  };
}

/** Events within 2h of kickoff are promoted to the live-style Upcoming cards. */
const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;
/** A match stays LIVE for this long after kickoff; after that it is ENDED. */
export const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse the admin event dateKey/time pair into a local kickoff Date. */
export function parseKickoff(dateKey?: string, time?: string): Date | null {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  let hours = 0;
  let minutes = 0;
  const raw = (time ?? '').trim().toUpperCase();
  if (raw) {
    const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    const h24 = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (ampm) {
      hours = Number(ampm[1]) % 12;
      minutes = Number(ampm[2] ?? 0);
      if (ampm[3] === 'PM') hours += 12;
    } else if (h24) {
      hours = Number(h24[1]);
      minutes = Number(h24[2]);
    } else {
      const hourOnly = raw.match(/^(\d{1,2})$/);
      if (!hourOnly) return null;
      hours = Number(hourOnly[1]);
    }
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const kickoff = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(kickoff.getTime()) ? null : kickoff;
}

function formatKickoffLabel(kickoff: Date, time?: string): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfKickoff = new Date(kickoff.getFullYear(), kickoff.getMonth(), kickoff.getDate());
  const dayDiff = Math.round((startOfKickoff.getTime() - startOfToday.getTime()) / 86_400_000);
  const dayLabel =
    dayDiff === 0
      ? 'Today'
      : dayDiff === 1
        ? 'Tomorrow'
        : `${WEEKDAY_NAMES[kickoff.getDay()]} ${kickoff.getDate()} ${MONTH_NAMES[kickoff.getMonth()]}`;
  return `${dayLabel} · ${time?.trim() || kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Map a soon-kicking-off fixture onto the live-card presentation. */
export function adminUpcomingToLiveMatch(
  ev: AdminUpcomingEvent,
  kickoff: Date,
  opts: { asLive?: boolean } = {},
): LiveMatch {
  const [leftTheme, rightTheme] = SPORT_THEMES[ev.sport] ?? SPORT_THEMES.other;
  // Failover sources for imported matches: the primary first, then the rest.
  const seenUrls = new Set<string>();
  const streams: NonNullable<LiveMatch['streams']> = [];
  const pushSource = (url: string, label: string, headers: StreamHeaders, id: string): void => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    streams.push({
      id,
      label,
      url: url.startsWith('/api/iptv/stream') ? url : buildProxiedUrl(url, headers, isHlsUrl(url)),
    });
  };
  (ev.customStreams ?? []).forEach((s, i) =>
    pushSource(s.url, s.title || `Stream ${i + 1}`, headersFromMatchStream(s), `cs-${i}`),
  );
  pushSource(ev.streamUrl ?? '', 'Primary stream', ev.headers, 'primary');
  const streamUrl = streams[0]?.url;
  return {
    id: `iptv-up-${ev.id}`,
    sport: ev.sport,
    homeTeam: ev.homeTeam,
    awayTeam: ev.awayTeam,
    homeCrest: ev.homeLogoUrl || ev.homeTeam,
    awayCrest: ev.awayLogoUrl || ev.awayTeam,
    homeScore: 0,
    awayScore: 0,
    league: ev.league,
    leagueCrest: ev.leagueLogo || ev.league,
    elapsedSeconds: 0,
    statusLabel: opts.asLive ? 'LIVE' : 'UPCOMING',
    isUpcoming: !opts.asLive,
    quality: 'HD',
    viewers: '',
    videoUrl: streamUrl,
    streams,
    leftTheme,
    rightTheme,
    venue: ev.league,
    stats: [],
    commentary: [],
    kickoffLabel: formatKickoffLabel(kickoff, ev.startTimestampMs ? undefined : ev.time),
    kickoffAt: kickoff.toISOString(),
    dateKey: ev.dateKey,
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  // Duplicate ids would surface as duplicate React keys, so keep the first.
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export interface MergedAppContent {
  liveMatches: LiveMatch[];
  /** Fixtures kicking off within the next 4 hours, shown with the live-card design. */
  upcomingMatches: LiveMatch[];
  /** Fixtures 5+ hours away (or with unparseable kickoff times), shown compact. */
  scheduledEvents: UpcomingEvent[];
  /** Every enabled fixture, used for reminders and the full fixtures page. */
  upcomingEvents: UpcomingEvent[];
  tvChannels: TVChannel[];
  heroSlides: HeroSlide[];
  settings: SiteSettings;
}

/**
 * Merge admin-managed IPTV content. Only channels, events and banners set up
 * in the admin console are shown — no built-in demo/mock content.
 */
export function mergeAppContent(data: AppData): MergedAppContent {
  // Live events: hide ones the 2h window has already ended; fixtures whose
  // kickoff time arrived are promoted from the upcoming list below.
  const adminLiveMatches = dedupeById(
    data.liveEvents
      .filter((e) => e.enabled && e.streamUrl)
      .filter((e) => computeEventStatus(e, (e.status ?? 'live') as AdminEventStatus) !== 'ended')
      .map((e) => adminEventToLiveMatch(e, data.channels)),
  );

  const tvChannels = dedupeById(
    data.channels
      .filter((c) => c.enabled)
      .map(iptvChannelToTVChannel),
  );

  const enabledUpcoming = data.upcomingEvents.filter((e) => e.enabled);
  const soonEntries: Array<{ ev: AdminUpcomingEvent; kickoff: Date }> = [];
  const laterEntries: AdminUpcomingEvent[] = [];
  const promotedLive: LiveMatch[] = [];
  for (const ev of enabledUpcoming) {
    const status = computeEventStatus(ev, (ev.status ?? 'scheduled') as AdminEventStatus);
    if (status === 'ended') continue; // past the live window — not shown publicly
    const kickoff = eventKickoffDate(ev);
    if (status === 'live') {
      // Kickoff time arrived (within the 2h live window) — show it live.
      promotedLive.push(adminUpcomingToLiveMatch(ev, kickoff ?? new Date(), { asLive: true }));
    } else if (status === 'upcoming' && kickoff) {
      soonEntries.push({ ev, kickoff });
    } else {
      laterEntries.push(ev);
    }
  }
  soonEntries.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  laterEntries.sort((a, b) => {
    const aTime = eventKickoffDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = eventKickoffDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
  const upcomingMatches = soonEntries.map(({ ev, kickoff }) =>
    adminUpcomingToLiveMatch(ev, kickoff)
  );
  const scheduledEvents = laterEntries.map(adminUpcomingToUpcomingEvent);
  const upcomingEvents = dedupeById(
    enabledUpcoming
      // Ended fixtures drop out of the public fixture list entirely.
      .filter((ev) => computeEventStatus(ev, (ev.status ?? 'scheduled') as AdminEventStatus) !== 'ended')
      .map(adminUpcomingToUpcomingEvent),
  );

  // Banners: only admin-created banners, mapped to their target event's playable match.
  const adminSlides: HeroSlide[] = data.banners
    .filter((b) => b.enabled)
    .map((b) => {
      const targetEvent = data.liveEvents.find((e) => e.id === b.targetEventId);
      return {
        id: `iptv-bn-${b.id}`,
        sport: b.sport,
        headlineTop: b.headlineTop,
        headlineHighlight: b.headlineHighlight,
        headlineBottom: b.headlineBottom,
        subtitleLine1: b.subtitleLine1,
        subtitleLine2: b.subtitleLine2,
        ctaLabel: b.ctaLabel,
        matchId: targetEvent ? `iptv-ev-${targetEvent.id}` : adminLiveMatches[0]?.id,
        bgGradient: b.bgGradient,
        imageUrl: b.imageUrl?.trim() || undefined,
      };
    });

  const heroSlides = dedupeById(adminSlides);

  const settings: SiteSettings = { ...DEFAULT_SITE_SETTINGS, ...(data.settings ?? {}) };

  return {
    liveMatches: dedupeById([...promotedLive, ...adminLiveMatches]),
    upcomingMatches,
    scheduledEvents,
    upcomingEvents: upcomingEvents,
    tvChannels,
    heroSlides,
    settings,
  };
}
