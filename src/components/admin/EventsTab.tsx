import React, { useRef, useState } from 'react';
import { CalendarClock, Check, Pencil, Plus, Radio, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import {
  AdminEventStatus,
  AdminLiveEvent,
  AdminUpcomingEvent,
  IptvChannel,
  IptvSport,
  StreamHeaders,
} from '../../types/iptv';
import { createEvent, deleteEvent, deleteEvents, importMatches, updateEvent } from '../../lib/api';
import { computeEventStatus } from '../../lib/appData';
import { HeadersEditor, NeonField, NeonInput, NeonSelect, NeonToggle } from './ui';

interface EventsTabProps {
  liveEvents: AdminLiveEvent[];
  upcomingEvents: AdminUpcomingEvent[];
  channels: IptvChannel[];
  onChanged: () => void;
  onToast: (msg: string, error?: boolean) => void;
}

const SPORT_OPTIONS = [
  ['football', 'Football'],
  ['basketball', 'Basketball'],
  ['tennis', 'Tennis'],
  ['boxing', 'Boxing'],
  ['f1', 'F1'],
  ['cricket', 'Cricket'],
  ['mma', 'MMA'],
  ['golf', 'Golf'],
] as const;

interface EventFormState {
  kind: 'live' | 'upcoming';
  homeTeam: string;
  awayTeam: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
  sport: string;
  league: string;
  dateKey: string;
  time: string;
  status: AdminEventStatus;
  channel: string;
  streamMode: 'channel' | 'url';
  /** Ordered failover sources; selection order = playback order. */
  channelIds: string[];
  streamUrl: string;
  headers: StreamHeaders;
}

const STATUS_OPTIONS: Array<[AdminEventStatus, string]> = [
  ['scheduled', 'Scheduled'],
  ['upcoming', 'Upcoming'],
  ['live', 'Live'],
  ['ended', 'Ended'],
];

const statusBadgeClass = (status?: AdminEventStatus): string => {
  switch (status) {
    case 'live':
      return 'neon-badge neon-badge-live';
    case 'ended':
      return 'neon-badge opacity-60';
    case 'scheduled':
      return 'neon-badge';
    default:
      return 'neon-badge';
  }
};

const emptyForm = (): EventFormState => ({
  kind: 'live',
  homeTeam: '',
  awayTeam: '',
  homeLogoUrl: '',
  awayLogoUrl: '',
  sport: 'football',
  league: '',
  dateKey: new Date().toISOString().slice(0, 10),
  time: '20:00',
  status: 'live',
  channel: 'SportyLive 1 HD',
  streamMode: 'channel',
  channelIds: [],
  streamUrl: '',
  headers: {},
});

/** Toggle a channel in the ordered failover list (selection order preserved). */
const toggleChannelId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

export const EventsTab: React.FC<EventsTabProps> = ({
  liveEvents,
  upcomingEvents,
  channels,
  onChanged,
  onToast,
}) => {
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Multi-select across both event lists for bulk enable/disable.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setSectionSelected = (events: Array<{ id: string }>, on: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const ev of events) {
        if (on) next.add(ev.id);
        else next.delete(ev.id);
      }
      return next;
    });

  const bulkSetEnabled = async (on: boolean) => {
    if (busy || selectedIds.size === 0) return;
    setBusy(true);
    try {
      await Promise.all([...selectedIds].map((id) => updateEvent(id, { enabled: on })));
      onToast(`${on ? 'Enabled' : 'Disabled'} ${selectedIds.size} event${selectedIds.size === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (busy || selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} event${selectedIds.size === 1 ? '' : 's'} permanently?`)) return;
    setBusy(true);
    try {
      const res = await deleteEvents([...selectedIds]);
      onToast(`Deleted ${res.deleted} event${res.deleted === 1 ? '' : 's'}`);
      setSelectedIds(new Set());
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.homeTeam.trim() || !form.awayTeam.trim()) {
      onToast('Team names are required', true);
      return;
    }
    const usingChannels = form.streamMode === 'channel' && form.channelIds.length > 0;
    if (form.kind === 'live' && !usingChannels && !form.streamUrl.trim()) {
      onToast('Pick at least one channel or provide a stream URL', true);
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateEvent(editingId, {
          homeTeam: form.homeTeam.trim(),
          awayTeam: form.awayTeam.trim(),
          homeLogoUrl: form.homeLogoUrl.trim(),
          awayLogoUrl: form.awayLogoUrl.trim(),
          sport: form.sport,
          league: form.league.trim() || 'Friendly',
          headers: form.headers,
          streamUrl: form.streamUrl.trim(),
          channelIds: form.kind === 'live' && form.streamMode === 'channel' ? form.channelIds : [],
          status: form.status,
          dateKey: form.dateKey,
          time: form.time.trim(),
          ...(form.kind === 'live'
            ? {}
            : { channel: form.channel.trim() || 'SportyLive 1 HD' }),
        });
        onToast(`Saved changes to "${form.homeTeam} vs ${form.awayTeam}"`);
        setEditingId(null);
        setForm(emptyForm());
        onChanged();
        return;
      }
      const shared = {
        homeTeam: form.homeTeam.trim(),
        awayTeam: form.awayTeam.trim(),
        homeLogoUrl: form.homeLogoUrl.trim() || undefined,
        awayLogoUrl: form.awayLogoUrl.trim() || undefined,
        sport: form.sport as IptvSport,
        headers: form.headers,
        streamUrl: form.streamUrl.trim() || undefined,
        channelIds: form.kind === 'live' && usingChannels ? form.channelIds : undefined,
        status: form.status,
        dateKey: form.dateKey,
        time: form.time.trim(),
      };
      if (form.kind === 'live') {
        await createEvent({
          kind: 'live',
          ...shared,
          league: form.league.trim() || 'Friendly',
        });
      } else {
        await createEvent({
          kind: 'upcoming',
          homeTeam: shared.homeTeam,
          awayTeam: shared.awayTeam,
          sport: shared.sport,
          headers: shared.headers,
          streamUrl: shared.streamUrl,
          league: form.league.trim() || 'Friendly',
          channel: form.channel.trim() || 'SportyLive 1 HD',
          dateKey: form.dateKey,
          time: form.time,
          status: form.status,
        });
      }
      onToast(
        form.kind === 'live'
          ? `Live event "${form.homeTeam} vs ${form.awayTeam}" published`
          : `Upcoming fixture "${form.homeTeam} vs ${form.awayTeam}" scheduled`
      );
      setForm(emptyForm());
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const toggleEvent = async (id: string, enabled: boolean) => {
    try {
      await updateEvent(id, { enabled });
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    }
  };

  const removeEvent = async (id: string, title: string) => {
    try {
      await deleteEvent(id);
      onToast(`Removed "${title}"`);
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    }
  };

  const startEdit = (ev: AdminLiveEvent | AdminUpcomingEvent) => {
    const live = 'homeScore' in ev;
    setForm({
      kind: live ? 'live' : 'upcoming',
      homeTeam: ev.homeTeam,
      awayTeam: ev.awayTeam,
      homeLogoUrl: ('homeLogoUrl' in ev && ev.homeLogoUrl) || '',
      awayLogoUrl: ('awayLogoUrl' in ev && ev.awayLogoUrl) || '',
      sport: ev.sport,
      league: ev.league,
      dateKey: ev.dateKey || new Date().toISOString().slice(0, 10),
      time: ev.time || '',
      status: ev.status ?? (live ? 'live' : 'upcoming'),
      channel: 'channel' in ev ? ev.channel : 'SportyLive 1 HD',
      streamMode: !live ? 'url' : (ev as AdminLiveEvent).channelId || (ev as AdminLiveEvent).channelIds?.length ? 'channel' : 'url',
      channelIds: live ? ((ev as AdminLiveEvent).channelIds?.length ? (ev as AdminLiveEvent).channelIds! : (ev as AdminLiveEvent).channelId ? [(ev as AdminLiveEvent).channelId!] : []) : [],
      streamUrl: ev.streamUrl ?? '',
      headers: ev.headers ?? {},
    });
    setEditingId(ev.id);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const isLive = form.kind === 'live';

  return (
    <div className="space-y-5">
      {/* Kind switch */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['live', 'upcoming'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              set('kind', k);
              set('status', k === 'live' ? 'live' : 'upcoming');
            }}
            disabled={!!editingId}
            className={`neon-tab px-4 py-2 text-xs font-display font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
              isLive === (k === 'live') ? 'neon-tab-active' : 'text-slate-600'
            }`}
          >
            {k === 'live' ? <Radio className="w-3.5 h-3.5" /> : <CalendarClock className="w-3.5 h-3.5" />}
            {k === 'live' ? 'Live Events' : 'Upcoming Fixtures'}
          </button>
        ))}
        {editingId && (
          <span className="neon-badge neon-badge-live inline-flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            editing {isLive ? 'live event' : 'fixture'}
          </span>
        )}
      </div>

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <div className="neon-card p-3 flex items-center gap-2 flex-wrap sticky top-2 z-10">
          <span className="neon-badge neon-badge-live">{selectedIds.size} selected</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void bulkSetEnabled(true)}
            className="neon-btn px-4 py-1.5 text-[11px] disabled:opacity-60"
          >
            <Check className="w-3.5 h-3.5" />
            Enable selected
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void bulkSetEnabled(false)}
            className="neon-btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-60"
          >
            Disable selected
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void bulkDelete()}
            className="neon-btn-ghost neon-btn-danger px-3 py-1.5 text-[11px] disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete selected
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="neon-btn-ghost px-3 py-1.5 text-[11px]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Match feed import (JSON / M3U) */}
      <ImportMatchesCard onChanged={onChanged} onToast={onToast} />

      {/* Create form */}
      <section className="neon-card neon-card-accent p-5">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h3 className="font-display font-extrabold text-sm text-slate-900">
            {editingId
              ? `Edit ${isLive ? 'Live Event' : 'Fixture'}`
              : isLive
                ? 'Publish Live Event'
                : 'Schedule Fixture'}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="neon-btn-ghost px-3 py-1.5 text-[11px]"
            >
              <X className="w-3.5 h-3.5" />
              Cancel edit
            </button>
          )}
        </div>
        <form ref={formRef} onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NeonField label="Home Team">
            <NeonInput value={form.homeTeam} onChange={(e) => set('homeTeam', e.target.value)} placeholder="Real Madrid" />
          </NeonField>
          <NeonField label="Away Team">
            <NeonInput value={form.awayTeam} onChange={(e) => set('awayTeam', e.target.value)} placeholder="Barcelona" />
          </NeonField>
          <NeonField label="Sport">
            <NeonSelect value={form.sport} onChange={(e) => set('sport', e.target.value)}>
              {SPORT_OPTIONS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </NeonSelect>
          </NeonField>
          <NeonField label="League">
            <NeonInput value={form.league} onChange={(e) => set('league', e.target.value)} placeholder="LaLiga" />
          </NeonField>
          <NeonField label="Home Team Logo URL">
            <NeonInput value={form.homeLogoUrl} onChange={(e) => set('homeLogoUrl', e.target.value)} placeholder="https://…/real-madrid.png" />
          </NeonField>
          <NeonField label="Away Team Logo URL">
            <NeonInput value={form.awayLogoUrl} onChange={(e) => set('awayLogoUrl', e.target.value)} placeholder="https://…/barcelona.png" />
          </NeonField>

          {isLive ? (
            <>
              <NeonField label="Stream Source" className="col-span-2">
                <NeonSelect
                  value={form.streamMode}
                  onChange={(e) => set('streamMode', e.target.value as 'channel' | 'url')}
                >
                  <option value="channel">Use existing channel</option>
                  <option value="url">Custom stream URL</option>
                </NeonSelect>
              </NeonField>
              {form.streamMode === 'channel' ? (
                <NeonField label="Stream Sources (order = failover order)" className="col-span-2">
                  {channels.length === 0 ? (
                    <p className="text-[10.5px] text-slate-500">Import a playlist first — no channels available.</p>
                  ) : (
                    <>
                      {form.channelIds.length > 0 && (
                        <p className="mb-1.5 text-[10.5px] text-slate-600 flex items-center flex-wrap gap-1">
                          {form.channelIds.map((id, i) => {
                            const ch = channels.find((c) => c.id === id);
                            return ch ? <span key={id} className="neon-badge">{i + 1}. {ch.name}</span> : null;
                          })}
                        </p>
                      )}
                      <div
                        role="group"
                        aria-label="Stream sources"
                        className="max-h-44 overflow-y-auto rounded-xl bg-[#EEF4FF] border border-white/85 shadow-[inset_2px_2px_6px_rgba(163,189,226,0.4),inset_-2px_-2px_6px_rgba(255,255,255,0.9)] p-2 space-y-0.5"
                      >
                        {channels.map((c) => {
                          const order = form.channelIds.indexOf(c.id);
                          const checked = order >= 0;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              role="checkbox"
                              aria-checked={checked}
                              onClick={() => set('channelIds', toggleChannelId(form.channelIds, c.id))}
                              className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-display font-semibold transition-colors cursor-pointer ${
                                checked ? 'bg-[#1D6BFF]/10 text-[#1D6BFF]' : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[8px] font-black ${
                                  checked
                                    ? 'bg-[#1D6BFF] text-white'
                                    : 'bg-white border border-slate-300 text-transparent'
                                }`}
                              >
                                {checked ? order + 1 : '✓'}
                              </span>
                              <span className="truncate">{c.name}</span>
                              {c.group && <span className="ml-auto text-[9.5px] text-slate-400 truncate shrink-0">{c.group}</span>}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[10.5px] text-slate-500">
                        Tick channels in play order. The first is primary; if it fails, viewers are switched to the next one.
                      </p>
                    </>
                  )}
                </NeonField>
              ) : (
                <NeonField label="IPTV Stream URL" className="col-span-2">
                  <NeonInput
                    value={form.streamUrl}
                    onChange={(e) => set('streamUrl', e.target.value)}
                    placeholder="https://edge.example/live/match.m3u8"
                  />
                </NeonField>
              )}
              <NeonField label="Date">
                <NeonInput type="date" value={form.dateKey} onChange={(e) => set('dateKey', e.target.value)} />
              </NeonField>
              <NeonField label="Kickoff Time">
                <NeonInput value={form.time} onChange={(e) => set('time', e.target.value)} placeholder="8:00 PM" />
              </NeonField>
              <NeonField label="Status">
                <NeonSelect value={form.status} onChange={(e) => set('status', e.target.value as AdminEventStatus)}>
                  <option value="scheduled">Scheduled</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="ended">Ended</option>
                </NeonSelect>
              </NeonField>
              <div className="col-span-2 md:col-span-4">
                <HeadersEditor headers={form.headers} onChange={(h) => set('headers', h)} />
                <p className="mt-2 text-[10.5px] text-slate-500">
                  Optional for existing channels (their own headers are used). Live events appear instantly in the
                  Live Now rail and play via the header-aware proxy.
                </p>
              </div>
            </>
          ) : (
            <>
              <NeonField label="Date">
                <NeonInput type="date" value={form.dateKey} onChange={(e) => set('dateKey', e.target.value)} />
              </NeonField>
              <NeonField label="Kickoff Time">
                <NeonInput value={form.time} onChange={(e) => set('time', e.target.value)} placeholder="6:30 PM" />
              </NeonField>
              <NeonField label="Channel / Program">
                <NeonInput value={form.channel} onChange={(e) => set('channel', e.target.value)} placeholder="Sky Sports PL" />
              </NeonField>
              <NeonField label="Status">
                <NeonSelect value={form.status} onChange={(e) => set('status', e.target.value as AdminEventStatus)}>
                  <option value="scheduled">Scheduled</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="ended">Ended</option>
                </NeonSelect>
              </NeonField>
              <NeonField label="Preview Stream URL (optional)" className="col-span-2 md:col-span-3">
                <NeonInput
                  value={form.streamUrl}
                  onChange={(e) => set('streamUrl', e.target.value)}
                  placeholder="https://edge.example/live/match.m3u8"
                />
              </NeonField>
              <div className="col-span-2 md:col-span-4">
                <HeadersEditor headers={form.headers} onChange={(h) => set('headers', h)} />
              </div>
            </>
          )}

          <div className="col-span-2 md:col-span-4 flex items-end justify-end gap-4">
            <button type="submit" disabled={busy} className="neon-btn px-5 py-2 text-xs shrink-0 disabled:opacity-60">
              {editingId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {busy ? 'Saving…' : editingId ? 'Save changes' : isLive ? 'Publish' : 'Schedule'}
            </button>
          </div>
        </form>
      </section>

      {/* Live events list */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 px-1 flex-wrap">
          <h3 className="font-display font-extrabold text-sm text-slate-900">
            Live Events <span className="text-slate-500">({liveEvents.length})</span>
          </h3>
          {liveEvents.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const allOn = liveEvents.every((e) => selectedIds.has(e.id));
                setSectionSelected(liveEvents, !allOn);
              }}
              className="neon-btn-ghost px-2.5 py-1 text-[10px]"
            >
              {liveEvents.every((e) => selectedIds.has(e.id)) ? 'Unselect all' : 'Select all'}
            </button>
          )}
        </div>
        {liveEvents.length === 0 ? (
          <div className="neon-card p-6 text-center text-xs text-slate-500">No live events published yet.</div>
        ) : (
          liveEvents.map((ev) => (
            <div key={ev.id} className="neon-row p-3.5 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                role="checkbox"
                aria-checked={selectedIds.has(ev.id)}
                aria-label={`Select ${ev.homeTeam} vs ${ev.awayTeam}`}
                onClick={() => toggleSelected(ev.id)}
                className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                  selectedIds.has(ev.id)
                    ? 'bg-[#1D6BFF] text-white'
                    : 'bg-white border border-slate-300 text-transparent hover:border-[#1D6BFF]/60'
                }`}
              >
                <Check className="w-3 h-3" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={statusBadgeClass(computeEventStatus(ev, ev.status ?? 'live'))} title="Status is derived from the event time (live = within 2h of kickoff, ended = past it)">
                    {computeEventStatus(ev, ev.status ?? 'live').toUpperCase()}
                  </span>
                  <span className="font-display font-bold text-xs text-slate-900 truncate">
                    {ev.homeTeam} vs {ev.awayTeam}
                  </span>
                  <span className="neon-badge">{ev.sport}</span>
                  <span className="neon-badge">{ev.quality}</span>
                  <span className="font-display font-black text-xs neon-prisma-text tabular-nums">
                    {ev.homeScore}-{ev.awayScore}
                  </span>
                </div>
                <p className="mt-0.5 text-[10.5px] text-slate-500 truncate">
                  {[
                    ev.startTimestampMs
                      ? `${ev.dateKey ?? ''} · ${new Date(ev.startTimestampMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (your time)`
                      : [ev.dateKey, ev.time].filter(Boolean).join(' · '),
                    ev.league,
                    ev.venue,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ev.homeLogoUrl && (
                  <img src={ev.homeLogoUrl} alt="" className="w-6 h-6 rounded-full bg-white object-contain p-0.5 border border-white/80" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}
                {ev.awayLogoUrl && (
                  <img src={ev.awayLogoUrl} alt="" className="w-6 h-6 rounded-full bg-white object-contain p-0.5 border border-white/80" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                )}
                {ev.channelId && <span className="neon-badge">via channel</span>}
                {(ev.channelIds?.length ?? 0) > 1 && (
                  <span className="neon-badge neon-badge-live" title="Failover: first is primary, rest are backups">
                    {ev.channelIds!.length} streams
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(ev)}
                  className={`neon-btn-ghost px-2.5 py-1.5 ${editingId === ev.id ? 'neon-btn-accent' : ''}`}
                  aria-label={`Edit ${ev.homeTeam} vs ${ev.awayTeam}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <NeonToggle on={ev.enabled} onChange={(next) => toggleEvent(ev.id, next)} label={`Enable ${ev.homeTeam} vs ${ev.awayTeam}`} />
                <button
                  type="button"
                  onClick={() => removeEvent(ev.id, `${ev.homeTeam} vs ${ev.awayTeam}`)}
                  className="neon-btn-ghost neon-btn-danger px-2.5 py-1.5"
                  aria-label="Delete event"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Upcoming events list */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 px-1 flex-wrap">
          <h3 className="font-display font-extrabold text-sm text-slate-900">
            Upcoming Fixtures <span className="text-slate-500">({upcomingEvents.length})</span>
          </h3>
          {upcomingEvents.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const allOn = upcomingEvents.every((e) => selectedIds.has(e.id));
                setSectionSelected(upcomingEvents, !allOn);
              }}
              className="neon-btn-ghost px-2.5 py-1 text-[10px]"
            >
              {upcomingEvents.every((e) => selectedIds.has(e.id)) ? 'Unselect all' : 'Select all'}
            </button>
          )}
        </div>
        {upcomingEvents.length === 0 ? (
          <div className="neon-card p-6 text-center text-xs text-slate-500">No fixtures scheduled yet.</div>
        ) : (
          upcomingEvents.map((ev) => (
            <div key={ev.id} className="neon-row p-3.5 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                role="checkbox"
                aria-checked={selectedIds.has(ev.id)}
                aria-label={`Select ${ev.homeTeam} vs ${ev.awayTeam}`}
                onClick={() => toggleSelected(ev.id)}
                className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                  selectedIds.has(ev.id)
                    ? 'bg-[#1D6BFF] text-white'
                    : 'bg-white border border-slate-300 text-transparent hover:border-[#1D6BFF]/60'
                }`}
              >
                <Check className="w-3 h-3" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="neon-badge">{ev.dateKey}</span>
                  <span className={statusBadgeClass(computeEventStatus(ev, ev.status ?? 'scheduled'))} title="Status is derived from the event time (live = within 2h of kickoff, ended = past it)">
                    {computeEventStatus(ev, ev.status ?? 'scheduled').toUpperCase()}
                  </span>
                  <span className="font-display font-bold text-xs text-slate-900 truncate">
                    {ev.homeTeam} vs {ev.awayTeam}
                  </span>
                  <span className="neon-badge">{ev.sport}</span>
                  {ev.streamUrl && <span className="neon-badge neon-badge-live">preview stream</span>}
                </div>
                <p className="mt-0.5 text-[10.5px] text-slate-500 truncate">
                  {ev.time} · {ev.league} · {ev.channel}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(ev)}
                  className={`neon-btn-ghost px-2.5 py-1.5 ${editingId === ev.id ? 'neon-btn-accent' : ''}`}
                  aria-label={`Edit ${ev.homeTeam} vs ${ev.awayTeam}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <NeonToggle on={ev.enabled} onChange={(next) => toggleEvent(ev.id, next)} label={`Enable ${ev.homeTeam} vs ${ev.awayTeam}`} />
                <button
                  type="button"
                  onClick={() => removeEvent(ev.id, `${ev.homeTeam} vs ${ev.awayTeam}`)}
                  className="neon-btn-ghost neon-btn-danger px-2.5 py-1.5"
                  aria-label="Delete fixture"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

/** Paste-or-URL importer for match feeds (JSON or M3U with "A VS B" names). */
const ImportMatchesCard: React.FC<{
  onChanged: () => void;
  onToast: (msg: string, error?: boolean) => void;
}> = ({ onChanged, onToast }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [format, setFormat] = useState<'auto' | 'json' | 'm3u'>('auto');
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async () => {
    if (busy) return;
    if (!content.trim() && !sourceUrl.trim()) {
      onToast('Paste match data or provide a feed URL', true);
      return;
    }
    setBusy(true);
    try {
      const stats = await importMatches({
        content: content.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        format: format === 'auto' ? undefined : format,
      });
      onToast(
        `Imported ${stats.matched} matches (${stats.liveCreated} live, ${stats.upcomingCreated} fixtures, ${stats.updated} updated)` +
          (stats.skipped ? `, ${stats.skipped} duplicates skipped` : ''),
      );
      setContent('');
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setContent(await file.text());
  };

  if (!open) {
    return (
      <div className="neon-card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#1D6BFF]" />
            Import Matches (JSON / M3U)
          </h3>
          <p className="mt-0.5 text-[10.5px] text-slate-500">
            Paste a match feed or drop a URL. JSON matches use team1/team2 + stream_ads; M3U names use “TEAM1 VS TEAM2”.
            Stream lists become failover sources automatically.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="neon-btn px-4 py-2 text-xs shrink-0">
          <Upload className="w-3.5 h-3.5" />
          Import
        </button>
      </div>
    );
  }

  return (
    <section className="neon-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display font-extrabold text-sm text-slate-900">Import Matches</h3>
        <button type="button" onClick={() => setOpen(false)} className="neon-btn-ghost px-3 py-1.5 text-[11px]">
          <X className="w-3.5 h-3.5" />
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <NeonField label="Format">
          <NeonSelect value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="auto">Auto-detect</option>
            <option value="json">JSON</option>
            <option value="m3u">M3U</option>
          </NeonSelect>
        </NeonField>
        <NeonField label="Feed URL (optional)" className="md:col-span-2">
          <NeonInput
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/matches.json"
          />
        </NeonField>
      </div>
      <NeonField label="Paste JSON or M3U content">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={7}
          spellCheck={false}
          placeholder={'[\n  {\n    "team1": "Manchester City",\n    "team2": "Fulham",\n    "date": "2026-11-21",\n    "time": "06:30 PM",\n    "stream_ads": [{ "url": "http://…/master.m3u8", "user_agent": "Dalvik/2.1.0" }]\n  }\n]'}
          className="w-full rounded-xl bg-[#EEF4FF] border border-white/85 shadow-[inset_2px_2px_6px_rgba(163,189,226,0.4),inset_-2px_-2px_6px_rgba(255,255,255,0.9)] p-3 text-[11px] font-mono text-slate-800 outline-none focus:border-[#1D6BFF]/60"
        />
      </NeonField>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" disabled={busy} onClick={run} className="neon-btn px-5 py-2 text-xs disabled:opacity-60">
          {busy ? 'Importing…' : 'Import matches'}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="neon-btn-ghost px-3 py-2 text-[11px]"
        >
          <Upload className="w-3.5 h-3.5" />
          Load file (.json / .m3u / .m3u8)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.m3u,.m3u8,.txt,application/json"
          className="hidden"
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <span className="text-[10.5px] text-slate-500">
          Re-importing the same teams + date updates streams instead of duplicating.
        </span>
      </div>
    </section>
  );
};
