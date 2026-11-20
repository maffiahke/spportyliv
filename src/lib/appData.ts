import { buildProxiedUrl, isHlsUrl } from './proxy';
import { shortCode } from './m3u';
import {
  AdminLiveEvent,
  AdminUpcomingEvent,
  AppData,
  DEFAULT_SITE_SETTINGS,
  IptvChannel,
  SiteSettings,
} from '../types/iptv';
import {
  HeroSlide,
  LiveMatch,
  TVChannel,
  UpcomingEvent,
} from '../types/sports';
import {
  HERO_SLIDES as SAMPLE_HERO,
  LIVE_MATCHES as SAMPLE_LIVE,
  TV_CHANNELS as SAMPLE_TV,
  UPCOMING_EVENTS as SAMPLE_UPCOMING,
} from '../data/sportsData';

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

export function adminEventToLiveMatch(
  ev: AdminLiveEvent,
  channels: IptvChannel[] = [],
): LiveMatch {
  const [leftTheme, rightTheme] = SPORT_THEMES[ev.sport] ?? SPORT_THEMES.other;
  // Channel-linked events follow the channel's stream (auto-sync aware).
  const src = ev.channelId ? channels.find((c) => c.id === ev.channelId) : undefined;
  const rawUrl = src?.url || ev.streamUrl;
  const rawHeaders = src?.headers && Object.keys(src.headers).length > 0 ? src.headers : ev.headers;
  // Never re-proxy an already-proxied URL (would break the format flag).
  const streamUrl = rawUrl.startsWith('/api/iptv/stream')
    ? rawUrl
    : buildProxiedUrl(rawUrl, rawHeaders, isHlsUrl(rawUrl));
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
      (ev.status === 'ended'
        ? 'ENDED'
        : ev.status === 'scheduled'
          ? 'SCHEDULED'
          : ev.status === 'upcoming'
            ? 'UPCOMING'
            : undefined),
    quality: ev.quality,
    viewers: ev.viewers || '—',
    videoUrl: streamUrl,
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
  const date = new Date(`${ev.dateKey}T12:00:00`);
  const dayOfWeek = ev.dateKey
    ? ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][date.getDay()]
    : '';
  const dayNumber = ev.dateKey ? ev.dateKey.slice(8, 10) : '';
  const month = ev.dateKey ? ev.dateKey.slice(5, 7) : '';
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return {
    id: `iptv-up-${ev.id}`,
    sport: ev.sport,
    dayOfWeek,
    dayNumber,
    month: monthNames[Number(month) - 1] ?? month,
    dateKey: ev.dateKey,
    homeTeam: ev.homeTeam,
    awayTeam: ev.awayTeam,
    homeCrest: ev.homeTeam,
    awayCrest: ev.awayTeam,
    time: ev.time,
    league: ev.league,
    leagueCrest: ev.league,
    channel: ev.channel,
  };
}

/** Matches this close to kickoff are promoted to the live-style Upcoming cards. */
const UPCOMING_WINDOW_MS = 4 * 60 * 60 * 1000;
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
): LiveMatch {
  const [leftTheme, rightTheme] = SPORT_THEMES[ev.sport] ?? SPORT_THEMES.other;
  const rawUrl = ev.streamUrl ?? '';
  const streamUrl = rawUrl
    ? rawUrl.startsWith('/api/iptv/stream')
      ? rawUrl
      : buildProxiedUrl(rawUrl, ev.headers, isHlsUrl(rawUrl))
    : undefined;
  return {
    id: `iptv-up-${ev.id}`,
    sport: ev.sport,
    homeTeam: ev.homeTeam,
    awayTeam: ev.awayTeam,
    homeCrest: ev.homeTeam,
    awayCrest: ev.awayTeam,
    homeScore: 0,
    awayScore: 0,
    league: ev.league,
    leagueCrest: ev.league,
    elapsedSeconds: 0,
    statusLabel: 'UPCOMING',
    quality: 'HD',
    viewers: '',
    videoUrl: streamUrl,
    leftTheme,
    rightTheme,
    venue: ev.league,
    stats: [],
    commentary: [],
    isUpcoming: true,
    kickoffLabel: formatKickoffLabel(kickoff, ev.time),
    kickoffAt: kickoff.toISOString(),
    dateKey: ev.dateKey,
  };
}

function dedupeById<T extends { id: string }>(primary: T[], fallback: T[]): T[] {
  // Admin-managed content replaces the built-in demo content when present;
  // demo data only fills in while nothing has been imported yet.
  if (primary.length === 0) return fallback;
  // Duplicate ids would surface as duplicate React keys, so keep the first.
  const seen = new Set<string>();
  return primary.filter((item) => {
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
 * Merge admin-managed IPTV content with the built-in demo content.
 * Server content wins and appears first; demo content fills in behind it.
 */
export function mergeAppContent(data: AppData): MergedAppContent {
  const liveMatches = dedupeById(
    data.liveEvents
      .filter((e) => e.enabled && e.streamUrl)
      .map((e) => adminEventToLiveMatch(e, data.channels)),
    SAMPLE_LIVE
  );

  const tvChannels = dedupeById(
    data.channels
      .filter((c) => c.enabled)
      .map(iptvChannelToTVChannel),
    SAMPLE_TV
  );

  const enabledUpcoming = data.upcomingEvents.filter((e) => e.enabled);
  const now = Date.now();
  const soonEntries: Array<{ ev: AdminUpcomingEvent; kickoff: Date }> = [];
  const laterEntries: AdminUpcomingEvent[] = [];
  for (const ev of enabledUpcoming) {
    const kickoff = parseKickoff(ev.dateKey, ev.time);
    const msUntilKickoff = kickoff ? kickoff.getTime() - now : Number.POSITIVE_INFINITY;
    if (kickoff && msUntilKickoff >= 0 && msUntilKickoff <= UPCOMING_WINDOW_MS) {
      soonEntries.push({ ev, kickoff });
    } else {
      laterEntries.push(ev);
    }
  }
  soonEntries.sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
  laterEntries.sort((a, b) => {
    const aTime = parseKickoff(a.dateKey, a.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = parseKickoff(b.dateKey, b.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
  const upcomingMatches = soonEntries.map(({ ev, kickoff }) =>
    adminUpcomingToLiveMatch(ev, kickoff)
  );
  const hasAdminUpcoming = enabledUpcoming.length > 0;
  const scheduledEvents = hasAdminUpcoming
    ? laterEntries.map(adminUpcomingToUpcomingEvent)
    : SAMPLE_UPCOMING;
  const upcomingEvents = dedupeById(
    enabledUpcoming.map(adminUpcomingToUpcomingEvent),
    SAMPLE_UPCOMING
  );

  // Banners: admin banners first (mapped to their target event's playable match),
  // then the built-in slides.
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
        matchId: targetEvent ? `iptv-ev-${targetEvent.id}` : (liveMatches[0]?.id ?? SAMPLE_LIVE[0].id),
        bgGradient: b.bgGradient,
        imageUrl: b.imageUrl?.trim() || undefined,
      };
    });

  const heroSlides = dedupeById(adminSlides, SAMPLE_HERO);

  const settings: SiteSettings = { ...DEFAULT_SITE_SETTINGS, ...(data.settings ?? {}) };

  return {
    liveMatches,
    upcomingMatches,
    scheduledEvents,
    upcomingEvents,
    tvChannels,
    heroSlides,
    settings,
  };
}
