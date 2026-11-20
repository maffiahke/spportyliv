import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Image as ImageIcon,
  LayoutDashboard,
  ListVideo,
  Lock,
  LogOut,
  Menu,
  BellRing,
  Radio,
  Settings,
  ShieldCheck,
  Tv,
  X,
} from 'lucide-react';
import {
  AdminBanner,
  AdminLiveEvent,
  AdminUpcomingEvent,
  AppData,
  DEFAULT_SITE_SETTINGS,
  IptvChannel,
  IptvPlaylist,
  SiteSettings,
} from '../types/iptv';
import {
  adminLogin,
  clearAdminToken,
  fetchAdminAppData,
  getAdminToken,
  setAdminToken,
} from '../lib/api';
import { subscribeStoreChanges } from '../lib/realtime';
import { PlaylistsTab } from '../components/admin/PlaylistsTab';
import { ChannelsTab } from '../components/admin/ChannelsTab';
import { EventsTab } from '../components/admin/EventsTab';
import { BannersTab } from '../components/admin/BannersTab';
import { DashboardTab } from '../components/admin/DashboardTab';
import { SettingsTab } from '../components/admin/SettingsTab';
import { NotificationsTab } from '../components/admin/NotificationsTab';

type AdminTab =
  | 'dashboard'
  | 'playlists'
  | 'channels'
  | 'events'
  | 'banners'
  | 'notifications'
  | 'settings';

/* ───────────────────────── Login screen ───────────────────────── */

const LoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { token } = await adminLogin(username.trim(), password);
      setAdminToken(token);
      window.location.replace('/admin');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="neon-root min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm neon-card neon-card-accent p-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1D6BFF] to-[#7C3AED] text-white flex items-center justify-center shadow-[5px_5px_14px_rgba(29,107,255,0.4),-4px_-4px_12px_rgba(255,255,255,0.9)]">
            <Lock className="w-5 h-5" />
          </span>
          <div>
            <p className="font-display font-extrabold text-lg leading-none">
              <span className="text-slate-950">Sporty</span>
              <span className="text-[#1D6BFF] italic">Live</span>
              <span className="neon-prisma-text italic"> Admin</span>
            </p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
              IPTV Control Center
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="neon-label">Username</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="neon-input"
              placeholder="admin"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="neon-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="neon-input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="rounded-xl bg-[#FDECEF] border border-[#FECDD8] px-3 py-2 text-[11.5px] font-semibold text-[#E11D48]">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="neon-btn w-full py-2.5 text-sm disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-5 text-center text-[10px] text-slate-400">
          Restricted area · authorized operators only
        </p>
      </div>
    </div>
  );
};

/* ───────────────────────── Console shell ───────────────────────── */

interface ConsoleProps {
  onLogout: () => void;
}

const AdminConsole: React.FC<ConsoleProps> = ({ onLogout }) => {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [playlists, setPlaylists] = useState<IptvPlaylist[]>([]);
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [liveEvents, setLiveEvents] = useState<AdminLiveEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<AdminUpcomingEvent[]>([]);
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data: AppData = await fetchAdminAppData();
      setPlaylists(data.playlists);
      setChannels(data.channels);
      setLiveEvents(data.liveEvents);
      setUpcomingEvents(data.upcomingEvents);
      setBanners(data.banners);
      setSettings(data.settings ?? DEFAULT_SITE_SETTINGS);
    } catch {
      /* keep last state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Realtime: another admin (or the auto-sync scheduler) wrote to Neon — pull
  // the fresh snapshot so every console shows the same state.
  useEffect(() => subscribeStoreChanges({ onChange: () => void reload() }), [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const showToast = useCallback(
    (msg: string, error?: boolean) => {
      setToast({ msg, error });
      void reload();
    },
    [reload]
  );

  const tabs: Array<{
    id: AdminTab;
    label: string;
    hint: string;
    icon: React.ElementType;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', hint: 'Overview & stats', icon: LayoutDashboard, badge: undefined as unknown as number },
    { id: 'playlists', label: 'Playlists', hint: 'Import & sync M3U', icon: ListVideo, badge: playlists.length },
    { id: 'channels', label: 'Live TV', hint: 'Channels & headers', icon: Tv, badge: channels.length },
    { id: 'events', label: 'Events', hint: 'Live & fixtures', icon: CalendarClock, badge: liveEvents.length + upcomingEvents.length },
    { id: 'banners', label: 'Banners', hint: 'Hero carousel', icon: ImageIcon, badge: banners.length },
    { id: 'notifications', label: 'Notifications', hint: 'Browser push alerts', icon: BellRing, badge: undefined as unknown as number },
    { id: 'settings', label: 'Settings', hint: 'Contacts & site info', icon: Settings, badge: undefined as unknown as number },
  ];

  const enabledChannels = channels.filter((c) => c.enabled).length;

  const sidebarContent = (
    <>
      {/* Brand + actions */}
      <div className="flex items-center gap-3 px-1">
        <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1D6BFF] to-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-[4px_4px_12px_rgba(29,107,255,0.4),-3px_-3px_10px_rgba(255,255,255,0.9)]">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display font-extrabold text-sm leading-none tracking-tight">
            <span className="text-slate-950">Admin </span>
            <span className="neon-prisma-text italic">Prisma</span>
          </p>
          <p className="mt-1 text-[9.5px] font-semibold tracking-[0.07em] text-slate-500 uppercase truncate">
            IPTV Control Center
          </p>
        </div>
      </div>

      {/* Nav — the menu lives in the sidebar, never in a header */}
      <nav aria-label="Admin sections" className="mt-6 space-y-2">
        {tabs.map(({ id, label, hint, icon: Icon, badge }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setDrawerOpen(false);
              }}
              aria-pressed={active}
              className={`neon-tab rounded-[16px] w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer ${
                active ? 'neon-tab-active' : 'text-slate-600'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  active
                    ? 'bg-gradient-to-br from-[#1D6BFF] to-[#7C3AED] text-white shadow-[3px_3px_8px_rgba(29,107,255,0.35)]'
                    : 'neu-inset-sm text-slate-500'
                }`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`flex items-center gap-1.5 font-display font-bold text-xs whitespace-nowrap ${
                    active ? 'text-[#1D6BFF]' : 'text-slate-800'
                  }`}
                >
                  {label}
                  {badge !== undefined && badge > 0 && (
                    <span className="text-[9.5px] font-display font-extrabold text-slate-500">{badge}</span>
                  )}
                </span>
                <span className="text-[9.5px] text-slate-500 whitespace-nowrap">{hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* Status card */}
      <div className="neu-surface-sm rounded-[16px] p-3 space-y-2 mt-6">
        <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            Channels live
          </span>
          <span className="font-display font-bold text-slate-900 tabular-nums">
            {enabledChannels}/{channels.length}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-[#1D6BFF]" />
            Playlists
          </span>
          <span className="font-display font-bold text-slate-900 tabular-nums">{playlists.length}</span>
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-auto pt-6 space-y-2">
        <a
          href="/"
          className="neu-surface-sm neu-pressable w-full flex items-center gap-2 rounded-full px-3.5 py-2.5 text-[11.5px] font-display font-bold text-slate-700 hover:text-[#1D6BFF] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          View Public Site
        </a>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 rounded-full px-3.5 py-2.5 text-[11.5px] font-display font-bold text-[#E11D48] hover:bg-[#FDECEF] transition-colors cursor-pointer neu-surface-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </>
  );

  const tabTitle = tabs.find((t) => t.id === tab);

  return (
    <div className="neon-root min-h-screen">
      {/* Mobile top bar (only the drawer trigger + title; nav lives in the drawer) */}
      <div className="lg:hidden sticky top-0 z-40 bg-[#EEF4FF]/90 backdrop-blur-md border-b border-white/80 px-3 py-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open admin menu"
          className="neu-surface-sm neu-pressable w-9 h-9 rounded-full flex items-center justify-center text-slate-700 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>
        <span className="font-display font-extrabold text-sm">
          <span className="text-slate-950">Admin </span>
          <span className="neon-prisma-text italic">Prisma</span>
        </span>
        <span className="ml-auto neon-badge">{tabTitle?.label}</span>
      </div>

      <div className="flex">
        {/* Fixed desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col sticky top-0 h-screen w-64 shrink-0 border-r border-white/80 px-4 py-5 overflow-y-auto neon-scroll">
          {sidebarContent}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] neon-root border-r border-white/80 px-4 py-5 flex flex-col overflow-y-auto neon-scroll">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="self-end neu-surface-sm w-8 h-8 rounded-full flex items-center justify-center text-slate-600 cursor-pointer mb-2"
              >
                <X className="w-4 h-4" />
              </button>
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-7 py-5 lg:py-7">
          <div className="hidden lg:flex items-center justify-between mb-5">
            <h1 className="font-display font-extrabold text-lg tracking-tight">
              <span className="text-slate-950">{tabTitle?.label}</span>
              <span className="text-slate-400 font-bold"> — {tabTitle?.hint}</span>
            </h1>
          </div>

          {loading ? (
            <div className="neon-card p-8 text-center text-xs text-slate-500">Loading control center…</div>
          ) : tab === 'dashboard' ? (
            <DashboardTab
              playlists={playlists}
              channels={channels}
              liveEvents={liveEvents}
              upcomingEvents={upcomingEvents}
              bannerCount={banners.length}
              onNavigate={(next) => {
                setTab(next);
                setDrawerOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onChanged={reload}
              onToast={showToast}
            />
          ) : tab === 'notifications' ? (
            <NotificationsTab onToast={showToast} />
          ) : tab === 'settings' ? (
            <SettingsTab
              settings={settings}
              onSaved={(next) => {
                setSettings(next);
                void reload();
              }}
              onToast={showToast}
            />
          ) : tab === 'playlists' ? (
            <PlaylistsTab playlists={playlists} onChanged={reload} onToast={showToast} />
          ) : tab === 'channels' ? (
            <ChannelsTab channels={channels} onChanged={reload} onToast={showToast} />
          ) : tab === 'events' ? (
            <EventsTab
              liveEvents={liveEvents}
              upcomingEvents={upcomingEvents}
              channels={channels}
              onChanged={reload}
              onToast={showToast}
            />
          ) : (
            <BannersTab banners={banners} liveEvents={liveEvents} onChanged={reload} onToast={showToast} />
          )}
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 neon-toast px-4 py-2 text-xs font-display font-semibold max-w-[92vw] truncate"
          style={toast.error ? { background: 'linear-gradient(120deg, #E11D48, #F97316)' } : undefined}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── App root ───────────────────────── */

export const AdminApp: React.FC = () => {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    // Already have a token? Verify it against the server.
    const token = getAdminToken();
    if (!token) {
      setAuthed(false);
      return;
    }
    fetch('/api/admin/session', { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { authenticated: boolean }) => {
        if (!d.authenticated) clearAdminToken();
        setAuthed(d.authenticated);
      })
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed === false && !window.location.pathname.startsWith('/admin/login')) {
      window.location.replace('/admin/login');
    }
  }, [authed]);

  if (authed === null) {
    return (
      <div className="neon-root min-h-screen flex items-center justify-center">
        <p className="text-xs font-display font-bold text-slate-500">Checking session…</p>
      </div>
    );
  }

  if (!authed) return <LoginScreen />;

  return (
    <AdminConsole
      onLogout={() => {
        clearAdminToken();
        window.location.replace('/admin/login');
      }}
    />
  );
};
