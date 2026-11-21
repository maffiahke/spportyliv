import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCheck,
  ChevronRight,
  Home,
  Search,
  Trophy,
  Tv,
  User,
  X,
} from 'lucide-react';
import { SportCategoryIcon, SportyLiveLogo } from './components/IconsAndCrests';
import {
  EXTRA_SPORT_CATEGORIES,
  PRIMARY_SPORT_CATEGORIES,
} from './data/sportsData';
import {
  LiveMatch,
  NavTab,
  NotificationItem,
  SportCategoryId,
  TVChannel,
  UpcomingEvent,
} from './types/sports';
import { AppData, DEFAULT_SITE_SETTINGS } from './types/iptv';
import { fetchAppData } from './lib/api';
import { subscribeStoreChanges } from './lib/realtime';
import {
  fetchCurrentUser,
  loginAccount,
  logoutAccount,
  registerAccount,
} from './lib/auth';
import type { AppUser, AuthCredentials, SignUpCredentials } from './types/user';
import { mergeAppContent } from './lib/appData';
import { SiteFooter } from './components/SiteFooter';
import { HeroBanner } from './components/HeroBanner';
import { LiveMatchCard } from './components/LiveMatchCard';
import { UpcomingEventCard } from './components/UpcomingEventCard';
import { PlayerScreen } from './components/PlayerScreen';
import { PipPlayer } from './components/PipPlayer';
import { LiveTVView } from './components/LiveTVView';
import { AdSlot } from './components/ads/AdSlot';
import { AdBudgetProvider } from './components/ads/AdBudget';
import { AdsConsentBanner } from './components/ads/AdsConsentBanner';
import type { AdPlacementId } from './types/iptv';
import { FixturesView } from './components/FixturesView';
import { ProfileView } from './components/ProfileView';

interface ActiveStreamState {
  match: LiveMatch;
  channel?: TVChannel | null;
  isPip: boolean;
}

// Merged IPTV + demo content (recomputed when admin data refreshes).
const FALLBACK_CONTENT = mergeAppContent({
  playlists: [],
  channels: [],
  liveEvents: [],
  upcomingEvents: [],
  banners: [],
  settings: DEFAULT_SITE_SETTINGS,
});

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedSport, setSelectedSport] = useState<SportCategoryId>('all');
  const [showAllLive, setShowAllLive] = useState(false);
  const [showAllScheduled, setShowAllScheduled] = useState(false);
  const [moreSportsOpen, setMoreSportsOpen] = useState(false);

  // Interactive Search & Notifications
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // In-app notification tray starts empty — entries come from real activity
  // (reminders, new events), never from mock data.
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Match Reminders & Active Player Screen + PiP Playback State
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);
  const [activeStream, setActiveStream] = useState<ActiveStreamState | null>(null);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(true);
  const [playerMuted, setPlayerMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Signed-in viewer account (null = guest).
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Server-driven IPTV content (playlists → channels, events, banners).
  const [content, setContent] = useState(FALLBACK_CONTENT);
  const rawDataRef = useRef<AppData | null>(null);
  const reloadContent = useCallback(async () => {
    try {
      const data = await fetchAppData();
      rawDataRef.current = data;
      setContent(mergeAppContent(data));
    } catch {
      /* keep last known content */
    }
  }, []);

  useEffect(() => {
    void reloadContent();
  }, [reloadContent]);

  // Time-derived statuses must advance while the page is open: re-merge the
  // last fetched data periodically so a match flips UPCOMING → LIVE at kickoff
  // (and out of the live window 2h later) without waiting for a refetch.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (rawDataRef.current) setContent(mergeAppContent(rawDataRef.current));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // AdSense placements are part of the server settings, so toggling them in the
  // admin console takes effect on every open tab without a redeploy.
  const ads = content.settings?.ads;

  // Live updates: an admin edit (on this server or any other) pushes a change
  // frame, so the grid refreshes without the viewer touching anything.
  useEffect(() => subscribeStoreChanges({ onChange: () => void reloadContent() }), [reloadContent]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await fetchCurrentUser();
        if (!cancelled) setUser(current);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignIn = async (credentials: AuthCredentials) => {
    const next = await loginAccount(credentials);
    setUser(next);
    setToastMessage(`Welcome back, ${next.username}!`);
  };

  const handleSignUp = async (credentials: SignUpCredentials) => {
    const next = await registerAccount(credentials);
    setUser(next);
    setToastMessage(`Welcome to SportyLive, ${next.username}!`);
  };

  const handleSignOut = async () => {
    await logoutAccount();
    setUser(null);
    setToastMessage('Signed out — you are browsing as a guest');
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const matchParam = new URLSearchParams(window.location.search).get('match');
    if (matchParam) {
      const target = content.liveMatches.find((m) => m.id === matchParam);
      if (target) {
        setActiveStream({ match: target, channel: null, isPip: false });
      }
    }
  }, []);

  const unreadCount = notifications.filter((n) => n.unread).length;
  const isFullPlayerOpen = Boolean(activeStream && !activeStream.isPip);

  // Per-view ad plan in priority order. The budget provider keeps only the
  // first `ads.maxPerPage` configured units, so the header leaderboard and the
  // tab's own units share one cap instead of each firing independently.
  const adCandidates = useMemo<AdPlacementId[]>(() => {
    if (isFullPlayerOpen) return [];
    if (activeTab === 'home')
      return ['global-leaderboard', 'home-infeed', 'home-rail', 'home-top'];
    if (activeTab === 'live-tv') return ['global-leaderboard', 'tv-shelf'];
    if (activeTab === 'fixtures') return ['global-leaderboard', 'fixtures-divider'];
    if (activeTab === 'profile') return ['global-leaderboard', 'profile-rail'];
    return ['global-leaderboard'];
  }, [activeTab, isFullPlayerOpen]);

  const openPlayerScreen = (match?: LiveMatch, channel?: TVChannel | null) => {
    // A channel clicked with no live event plays its own stream — build a
    // minimal stand-in match so the player shell has its context.
    const effectiveMatch =
      match ??
      (channel
        ? ({
            id: `iptv-ch-live-${channel.id}`,
            sport: channel.sport,
            homeTeam: channel.name,
            awayTeam: 'Live',
            homeCrest: channel.name,
            awayCrest: channel.name,
            homeScore: 0,
            awayScore: 0,
            league: channel.currentShow || 'Live TV',
            leagueCrest: channel.currentShow || 'Live TV',
            elapsedSeconds: 0,
            quality: channel.quality,
            viewers: '—',
            videoUrl: channel.streamUrl,
            leftTheme: '#0A369D',
            rightTheme: '#8E0E42',
            venue: channel.currentShow || 'Live TV',
            stats: [],
            commentary: [],
          } as LiveMatch)
        : undefined);
    if (!effectiveMatch) {
      setToastMessage('Nothing to play yet');
      return;
    }
    setPlayerIsPlaying(true);
    setActiveStream({ match: effectiveMatch, channel: channel ?? null, isPip: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWatchMatchById = (matchId: string) => {
    const found = content.liveMatches.find((m) => m.id === matchId) || content.liveMatches[0];
    if (!found) {
      setToastMessage('No live events are set up yet');
      return;
    }
    openPlayerScreen(found, null);
  };

  const handleEnterPip = () => {
    setActiveStream((prev) => (prev ? { ...prev, isPip: true } : null));
  };

  const handleExpandFromPip = () => {
    setActiveStream((prev) => (prev ? { ...prev, isPip: false } : null));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Leaving the player stops playback unless the user already opened PiP
  // themselves via the PiP button — it never triggers automatically.
  const leavePlayerWithoutPip = () =>
    setActiveStream((prev) => (prev && prev.isPip ? prev : null));

  const handleSwitchTab = (tab: NavTab) => {
    leavePlayerWithoutPip();
    setActiveTab(tab);
  };

  const handleToggleNotify = (event: UpcomingEvent) => {
    setNotifiedIds((prev) => {
      const exists = prev.includes(event.id);
      const next = exists ? prev.filter((id) => id !== event.id) : [...prev, event.id];
      setToastMessage(
        exists
          ? `Removed reminder for ${event.homeTeam} vs ${event.awayTeam}`
          : `Reminder set for ${event.homeTeam} vs ${event.awayTeam}`
      );
      return next;
    });
  };

  const handleOpenUpcoming = (match: LiveMatch) => {
    if (!match.videoUrl) {
      setToastMessage(
        `${match.homeTeam} vs ${match.awayTeam} kicks off ${
          match.kickoffLabel ?? 'soon'
        }`
      );
      return;
    }
    openPlayerScreen(match, null);
  };

  const handleToggleUpcomingNotify = (matchId: string) => {
    const event = content.upcomingEvents.find((ev) => ev.id === matchId);
    if (event) handleToggleNotify(event);
  };

  const handleSelectSport = (sportId: SportCategoryId) => {
    setSelectedSport((prev) => (prev === sportId ? 'all' : sportId));
    setMoreSportsOpen(false);
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredLiveMatches = useMemo(() => {
    return content.liveMatches.filter((match) => {
      const matchesSport = selectedSport === 'all' || match.sport === selectedSport;
      const matchesSearch =
        !normalizedQuery ||
        match.homeTeam.toLowerCase().includes(normalizedQuery) ||
        match.awayTeam.toLowerCase().includes(normalizedQuery) ||
        match.league.toLowerCase().includes(normalizedQuery) ||
        match.sport.toLowerCase().includes(normalizedQuery);
      return matchesSport && matchesSearch;
    });
  }, [content, selectedSport, normalizedQuery]);

  const filteredUpcomingMatches = useMemo(() => {
    return content.upcomingMatches.filter((match) => {
      const matchesSport = selectedSport === 'all' || match.sport === selectedSport;
      const matchesSearch =
        !normalizedQuery ||
        match.homeTeam.toLowerCase().includes(normalizedQuery) ||
        match.awayTeam.toLowerCase().includes(normalizedQuery) ||
        match.league.toLowerCase().includes(normalizedQuery) ||
        match.sport.toLowerCase().includes(normalizedQuery);
      return matchesSport && matchesSearch;
    });
  }, [content, selectedSport, normalizedQuery]);

  const filteredScheduledEvents = useMemo(() => {
    return content.scheduledEvents.filter((ev) => {
      const matchesSport = selectedSport === 'all' || ev.sport === selectedSport;
      const matchesSearch =
        !normalizedQuery ||
        ev.homeTeam.toLowerCase().includes(normalizedQuery) ||
        ev.awayTeam.toLowerCase().includes(normalizedQuery) ||
        ev.league.toLowerCase().includes(normalizedQuery) ||
        ev.sport.toLowerCase().includes(normalizedQuery);
      return matchesSport && matchesSearch;
    });
  }, [content, selectedSport, normalizedQuery]);

  const visibleLiveMatches = filteredLiveMatches;
  const visibleUpcomingMatches = filteredUpcomingMatches;

  const visibleScheduledEvents =
    showAllScheduled || normalizedQuery
      ? filteredScheduledEvents
      : filteredScheduledEvents.slice(0, 2);

  const notifiedEventsList = content.upcomingEvents.filter((e) => notifiedIds.includes(e.id));

  return (
    <div className="min-h-screen flex flex-col pb-20 lg:pb-10 lg:pl-[264px]">
      {/* Desktop Sidebar Rail (lg+) */}
      <aside
        aria-label="Sidebar navigation"
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-[264px] flex-col bg-[#EAF2FF]/80 backdrop-blur-md border-r border-white/85 shadow-[6px_0_20px_rgba(163,189,226,0.25)] px-5 py-6"
      >
        {/* Brand */}
        <button
          type="button"
          onClick={() => handleSwitchTab('home')}
          className="flex items-center gap-3 text-left cursor-pointer rounded-2xl p-2 -m-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1D6BFF]"
        >
          <SportyLiveLogo className="w-11 h-11 drop-shadow-sm shrink-0" />
          <div className="min-w-0">
            <div className="font-display font-extrabold text-[22px] leading-none tracking-tight">
              Sporty<span className="text-[#1D6BFF]">Live</span>
            </div>
            <p className="mt-1 text-[9px] font-semibold tracking-[0.08em] text-slate-600 uppercase">
              Live Sports Streaming
            </p>
          </div>
        </button>

        {/* Nav */}
        <nav aria-label="Sidebar" className="mt-10 flex flex-col gap-2">
          {(
            [
              { id: 'home', label: 'Home', icon: Home, hint: 'Live now & upcoming' },
              { id: 'live-tv', label: 'Live TV', icon: Tv, hint: 'IPTV channels' },
              { id: 'fixtures', label: 'Fixtures', icon: Trophy, hint: 'Scheduled matches' },
              { id: 'profile', label: 'Profile', icon: User, hint: 'Reminders & settings' },
            ] as const
          ).map(({ id, label, icon: Icon, hint }) => {
            const active = !isFullPlayerOpen && activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSwitchTab(id)}
                title={hint}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all cursor-pointer ${
                  active
                    ? 'neu-inset-sm text-[#1D6BFF]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'fill-[#1D6BFF]/15 stroke-[2.2]' : 'stroke-[1.8]'}`} />
                <span className="font-display font-bold text-sm">{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-[#EAF2FF]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand Lockup (mobile/tablet only — desktop uses the sidebar) */}
          <button
            type="button"
            onClick={() => {
              leavePlayerWithoutPip();
              setActiveTab('home');
              setSelectedSport('all');
              setSearchQuery('');
            }}
            className="flex items-center gap-2 sm:gap-2.5 text-left cursor-pointer min-w-0 lg:hidden"
          >
            <SportyLiveLogo className="w-9 h-9 sm:w-11 sm:h-11 drop-shadow-sm shrink-0" />
            <div className="min-w-0">
              <div className="font-display font-extrabold text-[19px] sm:text-[25px] leading-none tracking-tight">
                <span className="text-slate-950">Sporty</span>
                <span className="text-[#1D6BFF] italic">Live</span>
              </div>
              <p className="mt-0.5 text-[8.5px] sm:text-[10px] font-semibold tracking-[0.03em] sm:tracking-[0.06em] text-slate-600 uppercase truncate">
                LIVE SPORTS STREAMING AND CHANNELS
              </p>
            </div>
          </button>

          {/* Right Action Circles: Search & Notifications */}
          <div className="flex items-center gap-2 sm:gap-2.5 relative shrink-0">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((s) => !s);
                setNotificationsOpen(false);
              }}
              aria-label="Toggle search"
              aria-expanded={searchOpen}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                searchOpen
                  ? 'neu-inset text-[#1D6BFF]'
                  : 'neu-surface-sm neu-pressable text-slate-800 hover:text-[#1D6BFF]'
              }`}
            >
              {searchOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Search className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setNotificationsOpen((n) => !n);
                setSearchOpen(false);
              }}
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
              className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                notificationsOpen
                  ? 'neu-inset text-[#1D6BFF]'
                  : 'neu-surface-sm neu-pressable text-slate-900 hover:text-[#1D6BFF]'
              }`}
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[19px] h-[19px] sm:min-w-[20px] sm:h-[20px] px-1 rounded-full bg-[#EF4444] text-white text-[10.5px] sm:text-[11px] font-display font-extrabold flex items-center justify-center ring-2 ring-[#EAF2FF] tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {notificationsOpen && (
              <div className="neu-surface fixed sm:absolute right-3.5 sm:right-0 top-16 sm:top-14 w-[calc(100vw-1.75rem)] sm:w-96 max-w-sm rounded-[24px] p-4 z-50">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-extrabold text-sm text-slate-950">
                    Live Alerts
                  </h2>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D6BFF] hover:underline cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      No alerts yet — you'll see reminders and live event alerts here.
                    </p>
                  ) : (
                    notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setNotifications((prev) =>
                          prev.map((n) =>
                            n.id === item.id ? { ...n, unread: false } : n
                          )
                        );
                        setNotificationsOpen(false);
                        if (item.matchId) {
                          handleWatchMatchById(item.matchId);
                        }
                      }}
                      className={`w-full text-left rounded-2xl p-3 transition-all cursor-pointer ${
                        item.unread
                          ? 'neu-surface-sm hover:text-[#1D6BFF]'
                          : 'neu-inset-sm opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-xs text-slate-900">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500">
                          {item.timeAgo}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
                    </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Expandable Search Input Bar */}
        {searchOpen && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  leavePlayerWithoutPip();
                  if (activeTab !== 'home') setActiveTab('home');
                }}
                placeholder="Search teams, leagues, or sports (e.g., Real Madrid, Arsenal, NBA, F1)..."
                className="neu-inset w-full rounded-full pl-10 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 w-7 h-7 rounded-full hover:bg-white/60 flex items-center justify-center text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Page Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-1.5 space-y-4 sm:space-y-5">
        <AdBudgetProvider ads={ads} candidates={adCandidates}>
        {/* One leaderboard per content view — never over the player. */}
        {!isFullPlayerOpen && (
          <AdSlot placement="global-leaderboard" ads={ads} className="mt-1.5" />
        )}
        {isFullPlayerOpen && activeStream ? (
          <PlayerScreen
            match={activeStream.match}
            channel={activeStream.channel}
            liveMatches={content.liveMatches}
            channels={content.tvChannels}
            isPlaying={playerIsPlaying}
            muted={playerMuted}
            onTogglePlay={() => setPlayerIsPlaying((p) => !p)}
            onToggleMute={() => setPlayerMuted((m) => !m)}
            onSelectStream={(nextMatch, nextChannel) =>
              openPlayerScreen(nextMatch, nextChannel)
            }
            onEnterPip={handleEnterPip}
            onBack={() => setActiveStream(null)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <>
                {/* Hero Banner */}
                <HeroBanner slides={content.heroSlides} onAction={handleWatchMatchById} />

                {/* Sport Categories Row (4 visible sports + More) */}
                <section aria-label="Sport categories">
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-4">
                    {PRIMARY_SPORT_CATEGORIES.map((cat) => {
                      const isActive = selectedSport === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectSport(cat.id)}
                          aria-pressed={isActive}
                          className={`group rounded-[16px] sm:rounded-[22px] py-2.5 px-0.5 sm:py-3.5 sm:px-3 flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                            isActive
                              ? 'neu-inset text-[#1D6BFF]'
                              : 'neu-surface neu-pressable hover:-translate-y-0.5'
                          }`}
                        >
                          <SportCategoryIcon
                            sport={cat.id}
                            className="w-7 h-7 sm:w-10 sm:h-10 transition-transform group-hover:scale-105"
                          />
                          <span
                            className={`font-display font-bold text-[10px] sm:text-xs tracking-tight truncate max-w-full ${
                              isActive ? 'text-[#1D6BFF]' : 'text-slate-900'
                            }`}
                          >
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}

                    {/* "More" Tile */}
                    <button
                      type="button"
                      onClick={() => setMoreSportsOpen((o) => !o)}
                      aria-expanded={moreSportsOpen}
                      className={`group rounded-[16px] sm:rounded-[22px] py-2.5 px-0.5 sm:py-3.5 sm:px-3 flex flex-col items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                        moreSportsOpen ||
                        EXTRA_SPORT_CATEGORIES.some((e) => e.id === selectedSport)
                          ? 'neu-inset text-[#1D6BFF]'
                          : 'neu-surface neu-pressable hover:-translate-y-0.5'
                      }`}
                    >
                      <SportCategoryIcon
                        sport="more"
                        className="w-7 h-7 sm:w-10 sm:h-10 transition-transform group-hover:scale-105"
                      />
                      <span
                        className={`font-display font-bold text-[10px] sm:text-xs tracking-tight ${
                          EXTRA_SPORT_CATEGORIES.some((e) => e.id === selectedSport)
                            ? 'text-[#1D6BFF]'
                            : 'text-slate-900'
                        }`}
                      >
                        More
                      </span>
                    </button>
                  </div>

                  {/* Expandable More Sports Strip */}
                  {moreSportsOpen && (
                    <div className="mt-3.5 neu-surface rounded-[20px] p-3 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSport('all');
                            setMoreSportsOpen(false);
                          }}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-display font-bold cursor-pointer transition-all ${
                            selectedSport === 'all'
                              ? 'bg-[#1D6BFF] text-white shadow-sm'
                              : 'neu-surface-sm text-slate-700 hover:text-[#1D6BFF]'
                          }`}
                        >
                          All Sports
                        </button>
                        {EXTRA_SPORT_CATEGORIES.map((extra) => (
                          <button
                            key={extra.id}
                            type="button"
                            onClick={() => handleSelectSport(extra.id)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-display font-bold cursor-pointer transition-all ${
                              selectedSport === extra.id
                                ? 'bg-[#1D6BFF] text-white shadow-sm'
                                : 'neu-surface-sm text-slate-700 hover:text-[#1D6BFF]'
                            }`}
                          >
                            <SportCategoryIcon sport={extra.id} className="w-4 h-4" />
                            <span>{extra.label}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMoreSportsOpen(false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  )}

                  {/* Active Filter Indicator */}
                  {(selectedSport !== 'all' || normalizedQuery) && (
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600 px-1">
                      <span>
                        Showing matches for{' '}
                        <strong className="text-slate-900 capitalize">
                          {selectedSport !== 'all' ? selectedSport : `"${searchQuery}"`}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSport('all');
                          setSearchQuery('');
                        }}
                        className="font-display font-bold text-[#1D6BFF] hover:underline cursor-pointer"
                      >
                        Reset filter
                      </button>
                    </div>
                  )}
                </section>

                {/* Home top unit: below the hero + sport row, above Live Now */}
                <AdSlot placement="home-top" ads={ads} />

                {/* Live Now + Upcoming Events */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                  {/* Live Now + Upcoming Column */}
                  <div className="lg:col-span-7 xl:col-span-8 space-y-5">
                  <section aria-label="Live now" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="neu-surface-sm w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                          <span className="w-3.5 h-3.5 rounded-full bg-[#EF4444]" />
                        </span>
                        <h2 className="font-display font-extrabold text-[20px] sm:text-[22px] text-slate-950 tracking-tight">
                          Live Now
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAllLive((s) => !s)}
                        className="neu-surface-sm neu-pressable inline-flex items-center gap-0.5 rounded-full px-3.5 py-1.5 text-xs font-display font-bold text-[#1D6BFF] transition-all cursor-pointer whitespace-nowrap min-h-[34px]"
                      >
                        <span>{showAllLive ? 'Show Less' : 'See All'}</span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 stroke-[2.5] transition-transform ${
                            showAllLive ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {visibleLiveMatches.length === 0 ? (
                      <div className="neu-surface rounded-[24px] p-6 text-center">
                        <p className="font-display font-bold text-sm text-slate-900">
                          No live broadcasts currently in this category
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedSport('all')}
                          className="mt-2.5 text-xs font-display font-bold text-[#1D6BFF] hover:underline cursor-pointer"
                        >
                          View all live matches
                        </button>
                      </div>
                    ) : (
                      <div
                        className={
                          showAllLive
                            ? 'grid grid-cols-1 xl:grid-cols-2 gap-4'
                            : 'flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory py-2 px-1 -mx-1 xl:grid xl:grid-cols-2 xl:gap-4 xl:overflow-visible xl:py-0 xl:px-0 xl:mx-0 xl:snap-none'
                        }
                      >
                        {visibleLiveMatches.map((match) => (
                          <div
                            key={match.id}
                            className={
                              showAllLive || visibleLiveMatches.length === 1
                                ? 'w-full'
                                : 'w-[89%] sm:w-[410px] shrink-0 snap-start xl:w-auto xl:shrink'
                            }
                          >
                            <LiveMatchCard
                              match={match}
                              onWatchLive={(m) => openPlayerScreen(m, null)}
                              onShareFeedback={(msg) => setToastMessage(msg)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* In-feed unit: after the Live Now row, before Upcoming */}
                  <AdSlot placement="home-infeed" ads={ads} />

                  {/* Upcoming (kickoff within 4 hours) — hidden when there is nothing to show */}
                  {visibleUpcomingMatches.length > 0 && (
                    <section aria-label="Upcoming matches" className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="neu-surface-sm w-8 h-8 rounded-full flex items-center justify-center text-[#1D6BFF] shrink-0">
                            <Calendar className="w-4 h-4 stroke-[2.3]" />
                          </span>
                          <div>
                            <h2 className="font-display font-extrabold text-[20px] sm:text-[22px] text-slate-950 tracking-tight">
                              Upcoming
                            </h2>
                            <p className="text-[11px] font-medium text-slate-500">
                              Kickoff within 4 hours
                            </p>
                          </div>
                        </div>
                        <span className="neu-inset-sm inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-display font-bold text-[#1D6BFF] whitespace-nowrap">
                          {visibleUpcomingMatches.length} soon
                        </span>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {visibleUpcomingMatches.map((match) => (
                          <LiveMatchCard
                            key={match.id}
                            match={match}
                            onWatchLive={handleOpenUpcoming}
                            onShareFeedback={(msg) => setToastMessage(msg)}
                            isNotified={notifiedIds.includes(match.id)}
                            onToggleNotify={() => handleToggleUpcomingNotify(match.id)}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  </div>

                  {/* Scheduled Events Column (5+ hours to kickoff) */}
                  <section
                    aria-label="Scheduled events"
                    className="lg:col-span-5 xl:col-span-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="neu-surface-sm w-8 h-8 rounded-full flex items-center justify-center text-[#1D6BFF] shrink-0">
                          <Calendar className="w-4 h-4 stroke-[2.3]" />
                        </span>
                        <div>
                          <h2 className="font-display font-extrabold text-[20px] sm:text-[22px] text-slate-950 tracking-tight">
                            Scheduled
                          </h2>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAllScheduled((s) => !s)}
                        className="neu-surface-sm neu-pressable inline-flex items-center gap-0.5 rounded-full px-3.5 py-1.5 text-xs font-display font-bold text-[#1D6BFF] transition-all cursor-pointer whitespace-nowrap min-h-[34px]"
                      >
                        <span>{showAllScheduled ? 'Show Top' : 'See All'}</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>

                    {visibleScheduledEvents.length === 0 ? (
                      <div className="neu-surface rounded-[22px] p-6 text-center">
                        <p className="font-display font-bold text-sm text-slate-900">
                          No scheduled events match this filter
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {visibleScheduledEvents.map((event) => (
                          <UpcomingEventCard
                            key={event.id}
                            event={event}
                            isNotified={notifiedIds.includes(event.id)}
                            onToggleNotify={handleToggleNotify}
                          />
                        ))}
                      </div>
                    )}

                    {/* Desktop-only sticky rail under the scheduled cards */}
                    <AdSlot
                      placement="home-rail"
                      ads={ads}
                      className="lg:sticky lg:top-[84px]"
                    />
                  </section>
                </div>
              </>
            )}

            {activeTab === 'live-tv' && (
              <LiveTVView
                channels={content.tvChannels}
                liveMatches={content.liveMatches}
                onWatchMatch={openPlayerScreen}
                ads={ads}
              />
            )}

            {activeTab === 'fixtures' && (
              <FixturesView
                upcomingMatches={content.upcomingMatches}
                scheduledEvents={content.scheduledEvents}
                notifiedIds={notifiedIds}
                onToggleNotify={handleToggleNotify}
                onToggleUpcomingNotify={handleToggleUpcomingNotify}
                onWatchMatch={handleOpenUpcoming}
                ads={ads}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                notifiedEvents={notifiedEventsList}
                onRemoveReminder={handleToggleNotify}
                user={user}
                authLoading={authLoading}
                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                onSignOut={handleSignOut}
              />
            )}
          </>
        )}
        {!isFullPlayerOpen && <SiteFooter settings={content.settings} />}
        </AdBudgetProvider>
      </main>

      {/* Docked Mobile Neumorphic Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#EEF4FF]/95 backdrop-blur-md border-t border-white/85 shadow-[0_-6px_18px_rgba(163,189,226,0.35)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-4 gap-1.5"
      >
        {(
          [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'live-tv', label: 'Live TV', icon: Tv },
            { id: 'fixtures', label: 'Fixtures', icon: Trophy },
            { id: 'profile', label: 'Profile', icon: User },
          ] as const
        ).map(({ id, label, icon: Icon }) => {
          const active = !isFullPlayerOpen && activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSwitchTab(id)}
              className={`flex flex-col items-center justify-center py-1.5 rounded-2xl min-h-[44px] transition-all cursor-pointer ${
                active
                  ? 'neu-inset-sm text-[#1D6BFF]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] ${active ? 'fill-[#1D6BFF]/15 stroke-[2.3]' : 'stroke-[1.9]'}`}
              />
              <span className="mt-0.5 font-display font-bold text-[10.5px] leading-tight">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Floating Draggable Picture-in-Picture Player */}
      {activeStream?.isPip && (
        <PipPlayer
          match={activeStream.match}
          channel={activeStream.channel}
          isPlaying={playerIsPlaying}
          muted={playerMuted}
          onTogglePlay={() => setPlayerIsPlaying((p) => !p)}
          onToggleMute={() => setPlayerMuted((m) => !m)}
          onExpand={handleExpandFromPip}
          onClose={() => setActiveStream(null)}
        />
      )}

      {/* Non-blocking Toast Banner */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 lg:left-auto lg:right-6 lg:translate-x-0 z-50 rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-display font-semibold shadow-xl whitespace-nowrap max-w-[calc(100vw-2rem)] lg:max-w-sm truncate"
        >
          {toastMessage}
        </div>
      )}

      {/* EEA/UK consent prompt; AdSense stays unloaded until the viewer answers */}
      {!isFullPlayerOpen && <AdsConsentBanner ads={ads} />}
    </div>
  );
}
