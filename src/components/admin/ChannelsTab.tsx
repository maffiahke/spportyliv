import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Pencil, Radio, RotateCcw, Save, Search, Trash2, Zap } from 'lucide-react';
import { IptvChannel, StreamHeaders } from '../../types/iptv';
import { deleteChannel, patchChannel, testStream, TestStreamResult } from '../../lib/api';
import { HeadersEditor, NeonField, NeonInput, NeonSelect, NeonToggle, Spinner } from './ui';

interface ChannelsTabProps {
  channels: IptvChannel[];
  onChanged: () => void;
  onToast: (msg: string, error?: boolean) => void;
}

const SHELF_OPTIONS = [
  ['featured', 'Featured'],
  ['recent', 'Recent'],
  ['popular', 'Popular'],
] as const;

const SPORT_OPTIONS = [
  ['football', 'Football'],
  ['basketball', 'Basketball'],
  ['tennis', 'Tennis'],
  ['boxing', 'Boxing'],
  ['f1', 'F1'],
  ['cricket', 'Cricket'],
  ['mma', 'MMA'],
  ['golf', 'Golf'],
  ['other', 'Other'],
] as const;

interface ChannelDraft {
  name: string;
  group: string;
  tvgId: string;
  tvgLogo: string;
  sport: IptvChannel['sport'];
  shelf: IptvChannel['shelf'];
  quality: IptvChannel['quality'];
  headers: StreamHeaders;
}

const draftOf = (c: IptvChannel): ChannelDraft => ({
  name: c.name,
  group: c.group ?? '',
  tvgId: c.tvgId ?? '',
  tvgLogo: c.tvgLogo ?? '',
  sport: c.sport,
  shelf: c.shelf,
  quality: c.quality,
  headers: c.headers ?? {},
});

/** Inline editable panel for a single IPTV channel. */
const ChannelEditor: React.FC<{
  channel: IptvChannel;
  busy: boolean;
  test?: TestStreamResult | { error: string };
  onSave: (id: string, body: Record<string, unknown>) => Promise<boolean>;
}> = ({ channel, busy, test, onSave }) => {
  const [draft, setDraft] = useState<ChannelDraft>(() => draftOf(channel));

  useEffect(() => {
    setDraft(draftOf(channel));
  }, [channel]);

  const set = <K extends keyof ChannelDraft>(key: K, value: ChannelDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(channel));

  const save = () =>
    void onSave(channel.id, {
      name: draft.name.trim() || channel.name,
      group: draft.group.trim(),
      tvgId: draft.tvgId.trim(),
      tvgLogo: draft.tvgLogo.trim(),
      sport: draft.sport,
      shelf: draft.shelf,
      quality: draft.quality,
      headers: draft.headers,
    });

  return (
    <div className="px-3 pb-3 pt-1 border-t border-[#D7E3F8] space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="neon-label !mb-0 flex items-center gap-1.5">
          <Pencil className="w-3 h-3" />
          Edit channel
          {dirty && <span className="neon-badge neon-badge-live">unsaved</span>}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft(draftOf(channel))}
            disabled={!dirty || busy}
            className="neon-btn-ghost px-2.5 py-1.5 text-[11px] disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || busy}
            className="neon-btn-accent px-3.5 py-1.5 text-[11px] disabled:opacity-40"
          >
            {busy ? <Spinner /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NeonField label="Channel name" className="lg:col-span-2">
          <NeonInput value={draft.name} onChange={(e) => set('name', e.target.value)} />
        </NeonField>
        <NeonField label="Group">
          <NeonInput value={draft.group} onChange={(e) => set('group', e.target.value)} placeholder="Sports" />
        </NeonField>
        <NeonField label="Sport">
          <NeonSelect value={draft.sport} onChange={(e) => set('sport', e.target.value as IptvChannel['sport'])}>
            {SPORT_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </NeonSelect>
        </NeonField>
        <NeonField label="Shelf placement">
          <NeonSelect value={draft.shelf} onChange={(e) => set('shelf', e.target.value as IptvChannel['shelf'])}>
            {SHELF_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </NeonSelect>
        </NeonField>
        <NeonField label="Quality badge">
          <NeonSelect value={draft.quality} onChange={(e) => set('quality', e.target.value as IptvChannel['quality'])}>
            <option value="HD">HD</option>
            <option value="4K">4K</option>
          </NeonSelect>
        </NeonField>
        <NeonField label="TVG ID">
          <NeonInput value={draft.tvgId} onChange={(e) => set('tvgId', e.target.value)} placeholder="beinsports.hd" />
        </NeonField>
        <NeonField label="Logo URL" className="sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2">
            <NeonInput value={draft.tvgLogo} onChange={(e) => set('tvgLogo', e.target.value)} placeholder="https://…/logo.png" />
            {draft.tvgLogo.trim() && (
              <img
                src={draft.tvgLogo}
                alt=""
                className="w-8 h-8 rounded-lg object-contain bg-white border border-white/70 shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25'; }}
              />
            )}
          </div>
        </NeonField>
      </div>

      <div>
        <span className="neon-label">Stream URL (provider-managed)</span>
        <p className="text-[10.5px] text-slate-500 font-mono break-all rounded-lg bg-[#F4F8FF] px-2.5 py-1.5 border border-white/70">
          {channel.url}
        </p>
      </div>

      {test && (
        <div>
          <span className="neon-label">Last stream test</span>
          {'error' in test ? (
            <p className="text-[11px] text-rose-600 font-mono break-all">{test.error}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <span className={`neon-badge ${test.finalStatus < 400 ? '' : 'neon-badge-live'}`}>
                HTTP {test.finalStatus}
              </span>
              <span className="neon-badge">{test.contentType ?? 'unknown type'}</span>
              {test.isHlsPlaylist && <span className="neon-badge neon-badge-live">HLS</span>}
              <span className="neon-badge">UA: {test.userAgentSent}</span>
            </div>
          )}
        </div>
      )}

      <HeadersEditor headers={draft.headers} onChange={(h) => set('headers', h)} />

      <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
        <Radio className="w-3 h-3" />
        Streams play through /api/iptv/stream so custom User-Agent & Referer headers are applied.
      </p>
    </div>
  );
};

export const ChannelsTab: React.FC<ChannelsTabProps> = ({ channels, onChanged, onToast }) => {
  const [query, setQuery] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestStreamResult | { error: string }>>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 40;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter(
      (c) =>
        (sportFilter === 'all' || c.sport === sportFilter) &&
        (!q || c.name.toLowerCase().includes(q) || (c.group ?? '').toLowerCase().includes(q))
    );
  }, [channels, query, sportFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const patch = async (id: string, body: Record<string, unknown>): Promise<boolean> => {
    setBusyId(id);
    try {
      await patchChannel(id, body);
      onChanged();
      onToast('Channel updated');
      return true;
    } catch (err) {
      onToast((err as Error).message, true);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c: IptvChannel) => {
    setBusyId(c.id);
    try {
      await deleteChannel(c.id);
      onToast(`Removed channel "${c.name}"`);
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusyId(null);
    }
  };

  const runTest = async (c: IptvChannel) => {
    setBusyId(c.id);
    try {
      const result = await testStream(c.url, c.headers);
      setTestResult((prev) => ({ ...prev, [c.id]: result }));
      if ('error' in result) onToast(`Test failed: ${result.error}`, true);
      else onToast(`${c.name}: HTTP ${result.finalStatus} · ${result.contentType ?? '?'}`);
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search channels or groups…"
            className="neon-input pl-8"
          />
        </div>
        <NeonSelect
          value={sportFilter}
          onChange={(e) => {
            setSportFilter(e.target.value);
            setPage(1);
          }}
          className="w-36"
        >
          <option value="all">All sports</option>
          {SPORT_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </NeonSelect>
        <span className="neon-badge">{filtered.length} channels</span>
      </div>

      {/* Rows */}
      {visible.length === 0 ? (
        <div className="neon-card p-6 text-center text-xs text-slate-500">
          No channels match. Import a playlist first.
        </div>
      ) : (
        visible.map((c) => {
          const isOpen = expanded === c.id;
          const test = testResult[c.id];
          return (
            <div key={c.id} className="neon-row">
              <div className="p-3 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="w-8 h-8 rounded-lg neu-inset-sm flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-xs text-slate-900 truncate">{c.name}</span>
                    <span className="neon-badge">{c.quality}</span>
                    {c.alive === true && (
                      <span className="neon-badge" style={{ color: '#16a34a' }} title={c.checkedAt ? `Checked ${new Date(c.checkedAt).toLocaleString()}` : undefined}>
                        ● OK
                      </span>
                    )}
                    {c.alive === false && (
                      <span className="neon-badge" style={{ color: '#dc2626' }} title={c.checkedAt ? `Checked ${new Date(c.checkedAt).toLocaleString()} — stream did not return 200` : undefined}>
                        ● Dead
                      </span>
                    )}
                    {c.group && <span className="neon-badge">{c.group}</span>}
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500 truncate font-mono">{c.url}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <span className="neon-badge">{c.shelf}</span>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="neon-btn-ghost px-2.5 py-1.5 text-[11px]"
                    title="Edit channel details"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.enabled}
                    onClick={() => patch(c.id, { enabled: !c.enabled })}
                    className={`neon-toggle ${c.enabled ? 'neon-toggle-on' : ''}`}
                    aria-label={`Enable ${c.name}`}
                  />
                  <button
                    type="button"
                    onClick={() => runTest(c)}
                    disabled={busyId === c.id}
                    className="neon-btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-50"
                    title="Probe stream through the proxy"
                  >
                    {busyId === c.id ? <Spinner /> : <Zap className="w-3.5 h-3.5" />}
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    disabled={busyId === c.id}
                    className="neon-btn-ghost neon-btn-danger px-2.5 py-1.5 disabled:opacity-50"
                    aria-label={`Delete ${c.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <ChannelEditor channel={c} busy={busyId === c.id} test={test} onSave={patch} />
              )}
            </div>
          );
        })
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="neon-btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-40"
          >
            Prev
          </button>
          <span className="neon-badge">
            Page {safePage} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, safePage + 1))}
            disabled={safePage === pageCount}
            className="neon-btn-ghost px-3 py-1.5 text-[11px] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
