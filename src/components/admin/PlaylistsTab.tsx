import React, { useState } from 'react';
import { Check, Download, Eye, EyeOff, Pencil, RefreshCw, Repeat, Trash2, Upload, X } from 'lucide-react';
import { IptvPlaylist } from '../../types/iptv';
import {
  deletePlaylist,
  importPlaylist,
  refreshPlaylist,
  syncPlaylist,
  updatePlaylist,
  SyncStats,
} from '../../lib/api';
import { NeonField, NeonInput, NeonTextarea, Spinner, NeonToggle } from './ui';

interface PlaylistsTabProps {
  playlists: IptvPlaylist[];
  onChanged: () => void;
  onToast: (msg: string, error?: boolean) => void;
}

export const PlaylistsTab: React.FC<PlaylistsTabProps> = ({ playlists, onChanged, onToast }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [lastImport, setLastImport] = useState<{ count: number; sample: string[]; groups?: string[] } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!url.trim() && !content.trim()) {
      onToast('Provide a playlist URL or paste M3U content', true);
      return;
    }
    setBusy(true);
    try {
      const result = await importPlaylist({
        name: name.trim() || 'Imported Playlist',
        url: url.trim() || undefined,
        content: content.trim() || undefined,
      });
      setLastImport({ count: result.channelCount, sample: result.sample, groups: result.groups });
      setName('');
      setUrl('');
      setContent('');
      onToast(`Imported ${result.channelCount} channels from "${result.playlist.name}"`);
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const describeSync = (stats: SyncStats & { channelCount: number }) =>
    `${stats.channelCount} channels now — +${stats.added} added, ${stats.removed} removed`;

  const doSync = async (id: string) => {
    setBusyId(id);
    try {
      const res = await syncPlaylist(id);
      onToast(`Synced — ${describeSync(res)}`);
      onChanged();
    } catch (err) {
      onToast(`Sync failed: ${(err as Error).message}`, true);
    } finally {
      setBusyId(null);
    }
  };

  const doToggleAutoSync = async (pl: IptvPlaylist) => {
    setBusyId(pl.id);
    try {
      await updatePlaylist(pl.id, { autoSync: !pl.autoSync });
      onToast(
        pl.autoSync
          ? `Auto sync disabled for "${pl.name}"`
          : `Auto sync enabled — "${pl.name}" refreshes every 5 minutes`,
      );
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusyId(null);
    }
  };

  const doToggleEnabled = async (pl: IptvPlaylist) => {
    setBusyId(pl.id);
    try {
      const nextEnabled = pl.enabled === false;
      await updatePlaylist(pl.id, { enabled: nextEnabled });
      onToast(
        nextEnabled
          ? `"${pl.name}" enabled — ${pl.channelCount} channels are visible on the site`
          : `"${pl.name}" disabled — all its channels are hidden from the site`,
      );
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusyId(null);
    }
  };

  const startRename = (pl: IptvPlaylist) => {
    setRenameId(pl.id);
    setRenameValue(pl.name);
  };

  const doRename = async (pl: IptvPlaylist) => {
    const name = renameValue.trim();
    if (!name || name === pl.name) {
      setRenameId(null);
      return;
    }
    setBusyId(pl.id);
    try {
      await updatePlaylist(pl.id, { name });
      onToast(`Renamed playlist to "${name}"`);
      setRenameId(null);
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (pl: IptvPlaylist) => {
    setBusyId(pl.id);
    try {
      await deletePlaylist(pl.id);
      setConfirmDeleteId(null);
      onToast(`Deleted "${pl.name}" and its ${pl.channelCount} channels`);
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Import card */}
      <section className="neon-card neon-card-accent p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-violet-400/30 flex items-center justify-center text-[#7C3AED]">
            <Upload className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-display font-extrabold text-sm text-slate-900">Import Playlist</h3>
            <p className="text-[11px] text-slate-500">
              M3U / M3U8 — auto-parses stream headers (#EXTVLCOPT, #EXTHTTP, #KODIPROP)
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NeonField label="Playlist Name">
            <NeonInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Provider / Sports Pack"
            />
          </NeonField>
          <NeonField label="Playlist URL (remote)">
            <NeonInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://provider.example/get.php?username=…&type=m3u_plus"
            />
          </NeonField>
          <NeonField label="…or paste M3U text" className="md:col-span-2">
            <NeonTextarea
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'#EXTM3U\n#EXTINF:-1 tvg-id="…" tvg-logo="…" group-title="Sports",Bein Sports HD\n#EXTVLCOPT:http-user-agent=…\nhttps://edge.example/live/stream.m3u8'}
              className="font-mono text-[11px] leading-relaxed"
            />
          </NeonField>
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <p className="text-[10.5px] text-slate-500">
              Channels are stored server-side; each stream keeps its own User-Agent / Referer for playback.
            </p>
            <button type="submit" disabled={busy} className="neon-btn px-5 py-2 text-xs disabled:opacity-60">
              {busy ? <Spinner /> : <Download className="w-3.5 h-3.5" />}
              {busy ? 'Importing…' : 'Import Playlist'}
            </button>
          </div>
        </form>
      </section>

      {/* Last import result */}
      {lastImport && (
        <section className="neon-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="neon-badge neon-badge-live">NEW</span>
            <h4 className="font-display font-bold text-xs text-slate-900">{lastImport.count} channels imported</h4>
          </div>
          <ul className="space-y-1 text-[11px] text-slate-600">
            {lastImport.sample.map((s) => (
              <li key={s} className="truncate">• {s}</li>
            ))}
          </ul>
          {lastImport.groups && lastImport.groups.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {lastImport.groups.map((g) => (
                <span key={g} className="neon-badge">{g}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Playlist list */}
      <section className="space-y-3">
        <h3 className="font-display font-extrabold text-sm text-slate-900 px-1">
          Imported Playlists <span className="text-slate-500">({playlists.length})</span>
        </h3>
        {playlists.length === 0 ? (
          <div className="neon-card p-6 text-center text-xs text-slate-500">
            No playlists yet. Import your provider's M3U to power Live TV and match streams.
          </div>
        ) : (
          playlists.map((pl) => (
            <div key={pl.id} className="neon-row p-3.5 space-y-3">
              {/* Row: identity + actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {renameId === pl.id ? (
                      <span className="flex items-center gap-1.5">
                        <NeonInput
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void doRename(pl);
                            }
                            if (e.key === 'Escape') setRenameId(null);
                          }}
                          className="w-48 text-[11px] py-1"
                          aria-label="Playlist name"
                        />
                        <button
                          type="button"
                          onClick={() => void doRename(pl)}
                          disabled={busyId === pl.id}
                          className="neon-btn-accent px-2 py-1.5 disabled:opacity-50"
                          aria-label="Save name"
                        >
                          {busyId === pl.id ? <Spinner /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenameId(null)}
                          className="neon-btn-ghost px-2 py-1.5"
                          aria-label="Cancel rename"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : (
                      <>
                        <span className="font-display font-bold text-xs text-slate-900 truncate">{pl.name}</span>
                        <button
                          type="button"
                          onClick={() => startRename(pl)}
                          className="text-slate-500 hover:text-[#1D6BFF] transition-colors cursor-pointer"
                          aria-label={`Rename ${pl.name}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <span className="neon-badge">{pl.channelCount} ch</span>
                    {pl.enabled === false && (
                      <span className="neon-badge neon-badge-live">
                        <EyeOff className="w-3 h-3" />
                        hidden
                      </span>
                    )}
                    {pl.autoSync && <span className="neon-badge neon-badge-live">auto sync · 10 min</span>}
                    {pl.lastError && <span className="neon-badge neon-badge-live">last sync failed</span>}
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-slate-500 truncate">
                    {pl.sourceUrl ?? 'pasted content'} · imported {new Date(pl.importedAt).toLocaleString()}
                    {pl.lastSyncedAt && ` · last sync ${new Date(pl.lastSyncedAt).toLocaleTimeString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => doSync(pl.id)}
                    disabled={busyId === pl.id}
                    title="Re-fetch the playlist, add new streams and drop dead ones"
                    className="neon-btn-ghost px-3.5 py-1.5 text-[11px] disabled:opacity-50"
                  >
                    {busyId === pl.id ? <Spinner /> : <Repeat className="w-3.5 h-3.5" />}
                    Sync now
                  </button>
                  <button
                    type="button"
                    onClick={() => doToggleAutoSync(pl)}
                    disabled={busyId === pl.id}
                    title="Automatically re-sync this playlist every 5 minutes"
                    className={`neon-btn-ghost px-3.5 py-1.5 text-[11px] disabled:opacity-50 ${
                      pl.autoSync ? 'neon-btn-accent' : ''
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Auto sync {pl.autoSync ? 'on' : 'off'}
                  </button>
                  {confirmDeleteId === pl.id ? (
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => doDelete(pl)}
                        disabled={busyId === pl.id}
                        className="neon-btn-ghost neon-btn-danger px-3 py-1.5 text-[11px] disabled:opacity-50"
                      >
                        {busyId === pl.id ? <Spinner /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete {pl.channelCount} ch
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="neon-btn-ghost px-2.5 py-1.5 text-[11px]"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(pl.id)}
                      disabled={busyId === pl.id}
                      className="neon-btn-ghost neon-btn-danger px-3 py-1.5 text-[11px] disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {/* Frontend visibility toggle */}
              <div
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  pl.enabled === false
                    ? 'border-rose-200 bg-rose-50/70'
                    : 'border-white/70 bg-[#F4F8FF]'
                }`}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-display font-bold text-slate-800">
                    {pl.enabled === false ? (
                      <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    {pl.enabled === false ? 'Hidden from frontend' : 'Visible on frontend'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {pl.enabled === false
                      ? `All ${pl.channelCount} channels from this playlist are hidden from the public site.`
                      : `All ${pl.channelCount} channels from this playlist appear on the public site.`}
                  </p>
                </div>
                <NeonToggle
                  on={pl.enabled !== false}
                  onChange={() => doToggleEnabled(pl)}
                  label={`Show ${pl.name} on frontend`}
                />
              </div>
              {/* Auto-sync inline toggle */}
              <div className="flex items-center justify-between rounded-xl border border-white/70 bg-[#F4F8FF] px-3 py-2">
                <div>
                  <p className="text-[11px] font-display font-bold text-slate-800">
                    Auto sync every 5 minutes
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Re-fetches the playlist, adds new streams, drops streams that no longer exist. Keeps
                    your edits (enabled / sport / headers) on surviving streams.
                  </p>
                </div>
                <NeonToggle
                  on={!!pl.autoSync}
                  onChange={(v) => doToggleAutoSync(pl)}
                />
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};
