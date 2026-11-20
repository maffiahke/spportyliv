export type SportCategoryId =
  | 'all'
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'boxing'
  | 'f1'
  | 'cricket'
  | 'mma'
  | 'golf'
  | 'other';

export type NavTab = 'home' | 'live-tv' | 'fixtures' | 'profile';

// Build-in crests; dynamic IPTV content may use any string id (falls back to a monogram).
export type CrestId =
  | 'real-madrid'
  | 'barcelona'
  | 'man-utd'
  | 'chelsea'
  | 'arsenal'
  | 'tottenham'
  | 'laliga'
  | 'premier-league'
  | 'lakers'
  | 'celtics'
  | 'nba'
  | 'alcaraz'
  | 'sinner'
  | 'atp'
  | 'fury'
  | 'usyk'
  | 'boxing-belt'
  | 'f1-redbull'
  | 'f1-ferrari'
  | 'f1-league'
  | 'bayern'
  | 'dortmund'
  | 'bundesliga';

export interface LiveMatch {
  id: string;
  sport: Exclude<SportCategoryId, 'all'>;
  homeTeam: string;
  awayTeam: string;
  homeCrest: string;
  awayCrest: string;
  homeScore: number;
  awayScore: number;
  league: string;
  leagueCrest: string;
  elapsedSeconds: number;
  statusLabel?: string;
  quality: 'HD' | '4K';
  viewers: string;
  videoUrl?: string;
  leftTheme: string;
  rightTheme: string;
  venue: string;
  stats: {
    label: string;
    home: string;
    away: string;
  }[];
  commentary: {
    minute: string;
    text: string;
  }[];
  /** True when this is a fixture kicking off within the next 4 hours. */
  isUpcoming?: boolean;
  /** Human-friendly kickoff label for upcoming cards, e.g. "Today · 8:00 PM". */
  kickoffLabel?: string;
  /** ISO kickoff timestamp, used for the live countdown on upcoming cards. */
  kickoffAt?: string;
  /** ISO date of the fixture, used by the fixtures date filter. */
  dateKey?: string;
}

export interface UpcomingEvent {
  id: string;
  sport: Exclude<SportCategoryId, 'all'>;
  dayOfWeek: string;
  dayNumber: string;
  month: string;
  dateKey: string;
  homeTeam: string;
  awayTeam: string;
  homeCrest: string;
  awayCrest: string;
  time: string;
  league: string;
  leagueCrest: string;
  channel: string;
}

export interface TVChannel {
  id: string;
  name: string;
  shortCode: string;
  sport: Exclude<SportCategoryId, 'all'>;
  shelf: 'featured' | 'recent' | 'popular';
  logoVariant?:
    | 'willow'
    | 'willow-xtra'
    | 'tnt'
    | 'sky-pl'
    | 'bein'
    | 'star-1'
    | 'star-hindi'
    | 'ptv'
    | 'nba'
    | 'f1';
  currentShow: string;
  nextShow: string;
  quality: '4K' | 'HD';
  viewers: string;
  accentGradient: string;
  linkedMatchId?: string;
  /** Proxied IPTV stream URL (set for playlist-imported channels). */
  streamUrl?: string;
  /** Provider logo (tvg-logo) when available. */
  logoUrl?: string;
}

export interface HeroSlide {
  id: string;
  sport: SportCategoryId;
  headlineTop: string;
  headlineHighlight: string;
  headlineBottom: string;
  subtitleLine1: string;
  subtitleLine2: string;
  ctaLabel: string;
  matchId: string;
  bgGradient: string;
  /** Optional background photo; the gradient becomes a scrim over it. */
  imageUrl?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  timeAgo: string;
  unread: boolean;
  matchId?: string;
}
