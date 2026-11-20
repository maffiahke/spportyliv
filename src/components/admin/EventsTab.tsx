import React, { useRef, useState } from 'react';
import { CalendarClock, Check, Pencil, Plus, Radio, RotateCcw, Save, Trash2, X } from 'lucide-react';
import {
  AdminEventStatus,
  AdminLiveEvent,
  AdminUpcomingEvent,
  IptvChannel,
  IptvSport,
  StreamHeaders,
} from '../../types/iptv';
import { createEvent, deleteEvent, updateEvent } from '../../lib/api';
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
  channelId: string;
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
  channelId: '',
  streamUrl: '',
  headers: {},
});

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
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.homeTeam.trim() || !form.awayTeam.trim()) {
      onToast('Team names are required', true);
      return;
    }
    const usingChannel = form.streamMode === 'channel' && !!form.channelId.trim();
    if (form.kind === 'live' && !usingChannel && !form.streamUrl.trim()) {
      onToast('Pick an existing channel or provide a stream URL', true);
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
          channelId: form.kind === 'live' && form.streamMode === 'channel' ? form.channelId.trim() : '',
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
        channelId: form.kind === 'live' && usingChannel ? form.channelId.trim() : undefined,
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
      streamMode: !live ? 'url' : ev.channelId ? 'channel' : 'url',
      channelId: live ? ev.channelId || '' : '',
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
                <NeonField label="Channel" className="col-span-2">
                  <NeonSelect value={form.channelId} onChange={(e) => set('channelId', e.target.value)}>
                    <option value="">Select a channel…</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.group ? ` — ${c.group}` : ''}
                      </option>
                    ))}
                  </NeonSelect>
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
        <h3 className="font-display font-extrabold text-sm text-slate-900 px-1">
          Live Events <span className="text-slate-500">({liveEvents.length})</span>
        </h3>
        {liveEvents.length === 0 ? (
          <div className="neon-card p-6 text-center text-xs text-slate-500">No live events published yet.</div>
        ) : (
          liveEvents.map((ev) => (
            <div key={ev.id} className="neon-row p-3.5 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={statusBadgeClass(ev.status ?? 'live')}>
                    {(ev.status ?? 'live').toUpperCase()}
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
                  {[ev.dateKey, ev.time, ev.league, ev.venue].filter(Boolean).join(' · ')}
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
        <h3 className="font-display font-extrabold text-sm text-slate-900 px-1">
          Upcoming Fixtures <span className="text-slate-500">({upcomingEvents.length})</span>
        </h3>
        {upcomingEvents.length === 0 ? (
          <div className="neon-card p-6 text-center text-xs text-slate-500">No fixtures scheduled yet.</div>
        ) : (
          upcomingEvents.map((ev) => (
            <div key={ev.id} className="neon-row p-3.5 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="neon-badge">{ev.dateKey}</span>
                  <span className={statusBadgeClass(ev.status ?? 'upcoming')}>
                    {(ev.status ?? 'upcoming').toUpperCase()}
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
