import { SportCategoryId } from './sports.js';

/** Extra HTTP headers that must be sent when fetching an IPTV stream. */
export interface StreamHeaders {
  userAgent?: string;
  referer?: string;
  origin?: string;
  cookies?: string;
  /** Any other raw headers, lower-cased keys. */
  extra?: Record<string, string>;
}

export type IptvSport = Exclude<SportCategoryId, 'all'>;

/** An imported M3U/M3U8 playlist. */
export interface IptvPlaylist {
  id: string;
  name: string;
  /** Remote source (refreshable). */
  sourceUrl?: string;
  /** If imported by paste, the raw text is kept so refresh is possible. */
  sourceContent?: string;
  channelCount: number;
  importedAt: string;
  lastRefreshedAt?: string;
  /** Re-sync this playlist automatically every 5 minutes. */
  autoSync?: boolean;
  /**
   * Whether the playlist's channels are visible on the public site.
   * Missing means enabled (backwards compatible with older stores).
   */
  enabled?: boolean;
  lastSyncedAt?: string;
  lastError?: string;
}

/** A parsed channel entry from a playlist. */
export interface IptvChannel {
  id: string;
  playlistId: string;
  name: string;
  group?: string;
  tvgId?: string;
  tvgLogo?: string;
  /** Raw upstream stream URL. */
  url: string;
  headers: StreamHeaders;
  sport: IptvSport | 'other';
  shelf: 'featured' | 'recent' | 'popular';
  quality: '4K' | 'HD';
  enabled: boolean;
  /** Health: true when the last probe after sync returned HTTP 200, false when it did not; missing = never tested. */
  alive?: boolean;
  /** ISO timestamp of the last post-sync health probe. */
  checkedAt?: string;
}

/** Publication state of an admin-managed event. */
export type AdminEventStatus = 'scheduled' | 'upcoming' | 'live' | 'ended';

/** Admin-managed live event backed by an IPTV stream. */
export interface AdminLiveEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  sport: IptvSport;
  league: string;
  venue: string;
  homeScore: number;
  awayScore: number;
  statusLabel?: string;
  viewers?: string;
  quality: '4K' | 'HD';
  streamUrl: string;
  headers: StreamHeaders;
  /** Team crest images (optional). */
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  /** Stream inherited from an existing IPTV channel (follows auto-sync). */
  channelId?: string;
  /** Ordered failover list of channel references: first is primary, the rest are
   * used when earlier streams fail. channelIds[0] mirrors channelId. */
  channelIds?: string[];
  /** Direct stream sources (e.g. imported matches): played after channel sources
   * in the listed order. */
  customStreams?: MatchStream[];
  /** Publication state shown to viewers. */
  status?: AdminEventStatus;
  /** Exact kickoff epoch ms from imported feeds (authoritative for time-based status). */
  startTimestampMs?: number;
  /** Event date (ISO yyyy-mm-dd) and kickoff time. */
  dateKey?: string;
  time?: string;
  enabled: boolean;
}

/** Admin-managed upcoming fixture (optionally with a preview stream). */
export interface AdminUpcomingEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  sport: IptvSport;
  league: string;
  channel: string;
  /** Team logos from imported feeds (rendered as images by TeamCrest). */
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  /** League/competition badge from feeds that provide one (M3U tvg-logo). */
  leagueLogo?: string;
  /** ISO date, e.g. 2026-11-22 */
  dateKey: string;
  time: string;
  streamUrl?: string;
  headers: StreamHeaders;
  /** Direct failover sources for imported matches (first mirrors streamUrl). */
  customStreams?: MatchStream[];
  /** Channel-backed extra streams (playback order = array order). */
  channelIds?: string[];
  status?: AdminEventStatus;
  /** Exact kickoff epoch ms from imported feeds (authoritative for time-based status). */
  startTimestampMs?: number;
  enabled: boolean;
}

/** A direct stream source attached to an event (imported matches, custom URLs). */
export interface MatchStream {
  title?: string;
  quality?: string;
  url: string;
  userAgent?: string;
  referer?: string;
}

/** Admin-managed hero banner slide. */
export interface AdminBanner {
  id: string;
  sport: IptvSport;
  headlineTop: string;
  headlineHighlight: string;
  headlineBottom: string;
  subtitleLine1: string;
  subtitleLine2: string;
  ctaLabel: string;
  bgGradient: string;
  /** Optional hero background image (http(s) or data URI). Falls back to the gradient. */
  imageUrl?: string;
  targetEventId?: string;
  enabled: boolean;
}

/** Everything the server hands the web app. */
export interface AppData {
  playlists: IptvPlaylist[];
  channels: IptvChannel[];
  liveEvents: AdminLiveEvent[];
  upcomingEvents: AdminUpcomingEvent[];
  banners: AdminBanner[];
  settings: SiteSettings;
}

/** Public site branding, contact details and footer information. */
export interface SiteSettings {
  siteName: string;
  tagline: string;
  /** Contact */
  supportEmail: string;
  supportPhone: string;
  whatsapp: string;
  telegram: string;
  /** Telegram public channel (t.me/...) */
  telegramChannel: string;
  /** Telegram discussion group (t.me/...) */
  telegramGroup: string;
  website: string;
  address: string;
  hours: string;
  /** Social profiles */
  twitter: string;
  instagram: string;
  facebook: string;
  youtube: string;
  /** Footer */
  footerNote: string;
  copyright: string;
  updatedAt?: string;
  /** AdSense placements, managed from the admin console. */
  ads?: AdsSettings;
}

/** Which admin events should fire a browser push notification. */
export interface PushPrefs {
  newEvents: boolean;
  syncErrors: boolean;
  syncChanges: boolean;
}

/** Every place an ad unit can be mounted. */
export type AdPlacementId =
  | 'global-leaderboard'
  | 'home-top'
  | 'home-infeed'
  | 'home-rail'
  | 'tv-shelf'
  | 'fixtures-divider'
  | 'profile-rail';

export interface AdSlotSettings {
  enabled: boolean;
  /** AdSense ad unit id (`data-ad-slot`). */
  slotId: string;
}

/** Site-wide alternative-network script, injected once per page. */
export type AdNetworkKind = 'monetag' | 'adsterra';

export interface AdPageScriptSettings {
  enabled: boolean;
  /** Full script src copied from the network dashboard (MultiTag / Social Bar). */
  url: string;
}

/** Raw zone code (Monetag/Adsterra banner, native, etc.) used in one slot. */
export interface AdCodeSlotSettings {
  enabled: boolean;
  /** The snippet exactly as the network dashboard provides it. */
  code: string;
}

/** AdSense configuration managed from the admin console. */
export interface AdsSettings {
  enabled: boolean;
  /** `ca-pub-…`; falls back to the build-time VITE_ADSENSE_CLIENT. */
  publisherId: string;
  /** Hard cap of units rendered per page. */
  maxPerPage: number;
  /** Wait for a consent signal before loading the AdSense script (EEA/UK). */
  consentRequired: boolean;
  slots: Partial<Record<AdPlacementId, AdSlotSettings>>;
  /** Site-wide alternative networks — Monetag MultiTag, Adsterra Social Bar. */
  pageScripts?: Partial<Record<AdNetworkKind, AdPageScriptSettings>>;
  /** Per-slot alternative network zone code; wins when the AdSense unit id
   *  for that slot is empty (or AdSense is off). */
  altSlots?: Partial<Record<AdPlacementId, AdCodeSlotSettings>>;
}

export const AD_PLACEMENT_IDS: AdPlacementId[] = [
  'global-leaderboard',
  'home-top',
  'home-infeed',
  'home-rail',
  'tv-shelf',
  'fixtures-divider',
  'profile-rail',
];

export const DEFAULT_ADS_SETTINGS: AdsSettings = {
  enabled: false,
  publisherId: '',
  maxPerPage: 3,
  consentRequired: true,
  slots: Object.fromEntries(
    AD_PLACEMENT_IDS.map((id) => [id, { enabled: false, slotId: '' }]),
  ) as AdsSettings['slots'],
  pageScripts: {
    monetag: { enabled: false, url: '' },
    adsterra: { enabled: false, url: '' },
  },
  altSlots: Object.fromEntries(
    AD_PLACEMENT_IDS.map((id) => [id, { enabled: false, code: '' }]),
  ) as AdsSettings['altSlots'],
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'SportyLive',
  tagline: 'Live sports, every match, everywhere.',
  supportEmail: '',
  supportPhone: '',
  whatsapp: '',
  telegram: '',
  telegramChannel: '',
  telegramGroup: '',
  website: '',
  address: '',
  hours: '',
  twitter: '',
  instagram: '',
  facebook: '',
  youtube: '',
  footerNote: '',
  copyright: '',
  ads: { ...DEFAULT_ADS_SETTINGS, slots: { ...DEFAULT_ADS_SETTINGS.slots } },
};
