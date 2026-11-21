import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Layers,
  ListVideo,
  Radio,
  RefreshCw,
  Sparkles,
  Tv,
  Zap,
} from 'lucide-react';
import {
  AdminLiveEvent,
  AdminUpcomingEvent,
  IptvChannel,
  IptvPlaylist,
} from '../../types/iptv';
import { syncPlaylist } from '../../lib/api';
import { Spinner } from './ui';

interface DashboardTabProps {
  playlists: IptvPlaylist[];
  channels: IptvChannel[];
  liveEvents: AdminLiveEvent[];
  upcomingEvents: AdminUpcomingEvent[];
  bannerCount: number;
  onNavigate: (tab: 'playlists' | 'channels' | 'events' | 'banners') => void;
  onChanged: () => void;
  onToast: (msg: string, error?: boolean) => void;
}

const SPORT_LABELS: Record<string, string> = {
  football: 'Football',
  cricket: 'Cricket',
  basketball: 'Basketball',
  boxing: 'Boxing',
  f1: 'F1',
  tennis: 'Tennis',
  mma: 'MMA',
  golf: 'Golf',
  other: 'Other',
};

const StatCard: React.FC<{
  icon: React.ElementType;
  gradient: string;
  label: string;
  value: string | number;
  sub: string;
  onClick?: () => void;
}> = ({ icon: Icon, gradient, label, value, sub, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`neon-card p-4 flex items-center gap-4 text-left transition-all duration-200 ${
      onClick ? 'hover:-translate-y-0.5 cursor-pointer neon-pressable' : 'cursor-default'
    }`}
  >
    <span
      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${gradient} shadow-[4px_4px_14px_rgba(29,107,255,0.35),-3px_-3px_10px_rgba(255,255,255,0.9)]`}
    >
      <Icon className="w-5 h-5" />
    </span>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="font-display font-extrabold text-[26px] leading-tight text-slate-950 tabular-nums">
        {value}
      </p>
      <p className="text-[10.5px] text-slate-500 truncate">{sub}</p>
    </div>
  </button>
);

export const DashboardTab: React.FC<DashboardTabProps> = ({
  playlists,
  channels,
  liveEvents,
  upcomingEvents,
  bannerCount,
  onNavigate,
  onChanged,
  onToast,
}) => {
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const enabled = channels.filter((c) => c.enabled).length;
    const withLogo = channels.filter((c) => c.tvgLogo).length;
    const groups = new Set(channels.map((c) => c.group).filter(Boolean));
    const bySport = new Map<string, number>();
    channels.forEach((c) => {
      bySport.set(c.sport, (bySport.get(c.sport) ?? 0) + 1);
    });
    const sports = [...bySport.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([sport, count]) => ({
        sport,
        label: SPORT_LABELS[sport] ?? sport,
        count,
        pct: channels.length ? Math.round((count / channels.length) * 100) : 0,
      }));
    const autoSyncOn = playlists.filter((p) => p.autoSync).length;
    const lastSync = playlists
      .map((p) => p.lastSyncedAt ?? p.lastRefreshedAt)
      .filter(Boolean)
      .sort()
      .pop();
    const failing = playlists.filter((p) => p.lastError).length;
    return {
      enabled,
      withLogo,
      logoPct: channels.length ? Math.round((withLogo / channels.length) * 100) : 0,
      groups: groups.size,
      sports,
      autoSyncOn,
      lastSync,
      failing,
      liveEnabled: liveEvents.filter((e) => e.enabled).length,
      upcomingEnabled: upcomingEvents.filter((e) => e.enabled).length,
    };
  }, [channels, playlists, liveEvents, upcomingEvents]);

  const syncOne = async (id: string, name: string) => {
    setSyncingId(id);
    try {
      const r = await syncPlaylist(id);
      onToast(`Synced "${name}" — +${r.added} added, ${r.removed} removed`);
      onChanged();
    } catch (err) {
      onToast(`Sync failed: ${(err as Error).message}`, true);
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = async () => {
    if (syncingAll || playlists.length === 0) return;
    setSyncingAll(true);
    let added = 0;
    let removed = 0;
    let failed = 0;
    try {
      for (const p of playlists) {
        try {
          const r = await syncPlaylist(p.id);
          added += r.added;
          removed += r.removed;
        } catch {
          failed++;
        }
      }
      onToast(
        `Synced ${playlists.length} playlist${playlists.length === 1 ? '' : 's'} — +${added} added, ${removed} removed${failed ? `, ${failed} failed` : ''}`,
        failed > 0,
      );
      onChanged();
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero strip */}
      <section className="neon-card neon-card-accent p-5 flex flex-wrap items-center justify-between gap-4 overflow-hidden relative">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-lg text-slate-950 tracking-tight flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-[#1D6BFF]" />
            Control Center Overview
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Live snapshot of your IPTV platform — channels, sync health, events and banners.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={syncAll}
            disabled={syncingAll || playlists.length === 0}
            className="neon-btn px-4 py-2 text-xs disabled:opacity-60 cursor-pointer"
          >
            {syncingAll ? <Spinner /> : <Zap className="w-3.5 h-3.5" />}
            {syncingAll ? 'Syncing…' : 'Sync all playlists'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('playlists')}
            className="neon-btn-ghost px-4 py-2 text-xs cursor-pointer"
          >
            <ListVideo className="w-3.5 h-3.5" />
            Import
          </button>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-2 xl:grid-cols-3 gap-3.5">
        <StatCard
          icon={Tv}
          gradient="from-[#1D6BFF] to-[#38BDF8]"
          label="Channels"
          value={channels.length}
          sub={`${stats.enabled} enabled · ${stats.groups} groups`}
          onClick={() => onNavigate('channels')}
        />
        <StatCard
          icon={ListVideo}
          gradient="from-[#7C3AED] to-[#C084FC]"
          label="Playlists"
          value={playlists.length}
          sub={`${stats.autoSyncOn} auto-syncing every 5 min`}
          onClick={() => onNavigate('playlists')}
        />
        <StatCard
          icon={Radio}
          gradient="from-[#E11D48] to-[#FB923C]"
          label="Live Events"
          value={liveEvents.length}
          sub={`${stats.liveEnabled} published`}
          onClick={() => onNavigate('events')}
        />
        <StatCard
          icon={CalendarClock}
          gradient="from-[#0D9488] to-[#34D399]"
          label="Upcoming Fixtures"
          value={upcomingEvents.length}
          sub={`${stats.upcomingEnabled} scheduled`}
          onClick={() => onNavigate('events')}
        />
        <StatCard
          icon={ImageIcon}
          gradient="from-[#F59E0B] to-[#FBBF24]"
          label="Logo Coverage"
          value={`${stats.logoPct}%`}
          sub={`${stats.withLogo} of ${channels.length} channels`}
          onClick={() => onNavigate('channels')}
        />
        <StatCard
          icon={Layers}
          gradient="from-[#334155] to-[#64748B]"
          label="Banners"
          value={bannerCount}
          sub="Hero carousel slides"
          onClick={() => onNavigate('banners')}
        />
      </section>

      {/* Sync health + sport mix */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Playlist sync health */}
        <div className="xl:col-span-7 space-y-3">
          <h3 className="font-display font-extrabold text-sm text-slate-900 px-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1D6BFF]" />
            Playlist Sync Health
            {stats.failing > 0 && (
              <span className="neon-badge neon-badge-live inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.failing} failing
              </span>
            )}
          </h3>
          {playlists.length === 0 ? (
            <div className="neon-card p-6 text-center text-xs text-slate-500">
              No playlists yet — import an M3U to power Live TV.
            </div>
          ) : (
            playlists.map((p) => {
              // Truthful freshness: auto-sync ticks every 10 min on the external
              // scheduler — anything older than ~25 min means it isn't running.
              const lastSyncMs = p.lastSyncedAt ? Date.parse(p.lastSyncedAt) : NaN;
              const ageMin = Number.isFinite(lastSyncMs)
                ? Math.floor((Date.now() - lastSyncMs) / 60_000)
                : null;
              const stale = p.autoSync && (ageMin === null || ageMin > 25);
              const ageLabel =
                ageMin === null ? 'never synced' : ageMin < 1 ? 'just now' : `${ageMin} min ago`;
              return (
              <div key={p.id} className="neon-row p-3.5 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-xs text-slate-900 truncate">
                      {p.name}
                    </span>
                    <span className="neon-badge">{p.channelCount} ch</span>
                    {p.autoSync && (
                      <span className="neon-badge neon-badge-live">auto · 10 min</span>
                    )}
                    {p.lastError ? (
                      <span className="neon-badge neon-badge-live">error</span>
                    ) : stale ? (
                      <span
                        className="neon-badge inline-flex items-center gap-1"
                        title="Auto-sync has not run recently — check the scheduler (GitHub Actions) or press Sync now"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        stale{ageMin !== null ? ` · ${ageMin}m` : ''}
                      </span>
                    ) : (
                      <span className="neon-badge inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        healthy
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-slate-500 truncate flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {p.lastSyncedAt
                      ? `last sync ${new Date(p.lastSyncedAt).toLocaleTimeString()} (${ageLabel})`
                      : 'never synced'}
                    {p.lastError ? ` · ${(p.lastError || '').slice(0, 60)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => syncOne(p.id, p.name)}
                  disabled={syncingId === p.id}
                  className="neon-btn-ghost px-3.5 py-1.5 text-[11px] disabled:opacity-50 cursor-pointer"
                >
                  {syncingId === p.id ? <Spinner /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Sync now
                </button>
              </div>
              );
            })
          )}
        </div>

        {/* Sport distribution */}
        <div className="xl:col-span-5 space-y-3">
          <h3 className="font-display font-extrabold text-sm text-slate-900 px-1 flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#1D6BFF]" />
            Channels by Sport
          </h3>
          <div className="neon-card p-4 space-y-3">
            {stats.sports.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">No channels yet.</p>
            ) : (
              stats.sports.map((s) => (
                <div key={s.sport}>
                  <div className="flex items-center justify-between text-[11px] font-display font-bold text-slate-700 mb-1">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-slate-500">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#E5EEFD] shadow-[inset_2px_2px_5px_rgba(163,189,226,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1D6BFF] to-[#7C3AED] transition-all duration-500"
                      style={{ width: `${Math.max(s.pct, 3)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
