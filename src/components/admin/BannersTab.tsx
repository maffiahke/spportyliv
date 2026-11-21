import React, { useRef, useState } from 'react';
import { Image, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { AdminBanner, AdminLiveEvent, IptvSport } from '../../types/iptv';
import { createBanner, deleteBanner, updateBanner } from '../../lib/api';
import { NeonField, NeonInput, NeonSelect, NeonToggle } from './ui';

interface BannersTabProps {
  banners: AdminBanner[];
  liveEvents: AdminLiveEvent[];
  onChanged: () => void;
  onToast: (msg: string, error?: boolean) => void;
}

interface BannerFormState {
  sport: string;
  imageUrl: string;
  targetEventId: string;
}

const emptyForm = (): BannerFormState => ({
  sport: 'football',
  imageUrl: '',
  targetEventId: '',
});

/**
 * Image-only banners: the artwork (headline, players, logos) is fully
 * designed upstream — the admin just supplies the image and the event it
 * opens. 8:3 landscape (e.g. 640×240 or 1280×480) fills the hero exactly.
 */
export const BannersTab: React.FC<BannersTabProps> = ({ banners, liveEvents, onChanged, onToast }) => {
  const [form, setForm] = useState<BannerFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof BannerFormState>(key: K, value: BannerFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!form.imageUrl.trim()) {
      onToast('Banner image URL is required', true);
      return;
    }
    setBusy(true);
    try {
      // Overlay text fields are legacy (banners are image-only now) — send
      // empty/default values so the stored model stays valid.
      const legacy = {
        headlineTop: '',
        headlineHighlight: '',
        headlineBottom: '',
        subtitleLine1: '',
        subtitleLine2: '',
        ctaLabel: 'Watch Live',
        bgGradient: 'linear-gradient(115deg, #062163 0%, #0F47C7 45%, #092670 100%)',
      };
      if (editingId) {
        await updateBanner(editingId, {
          ...legacy,
          sport: form.sport,
          imageUrl: form.imageUrl.trim(),
          targetEventId: form.targetEventId || '',
        });
        onToast('Banner updated');
        setEditingId(null);
        setForm(emptyForm());
        onChanged();
        return;
      }
      await createBanner({
        sport: form.sport as IptvSport,
        ...legacy,
        imageUrl: form.imageUrl.trim(),
        targetEventId: form.targetEventId || undefined,
      });
      onToast('Banner published to the home carousel');
      setForm(emptyForm());
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (b: AdminBanner) => {
    setForm({
      sport: b.sport,
      imageUrl: b.imageUrl ?? '',
      targetEventId: b.targetEventId ?? '',
    });
    setEditingId(b.id);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const toggle = async (id: string, enabled: boolean) => {
    try {
      await updateBanner(id, { enabled });
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteBanner(id);
      onToast('Banner removed');
      onChanged();
    } catch (err) {
      onToast((err as Error).message, true);
    }
  };

  const previewUrl = form.imageUrl.trim();

  return (
    <div className="space-y-5">
      {/* Live preview strip — exactly what the hero will show */}
      <section className="neon-card neon-card-accent p-4">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Banner preview"
            className="w-full aspect-[8/3] object-cover rounded-[18px] bg-slate-950"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.opacity = '0.25';
            }}
          />
        ) : (
          <div className="w-full aspect-[8/3] rounded-[18px] bg-slate-950 flex items-center justify-center">
            <p className="text-[11px] text-slate-500">Paste an image URL to preview the banner</p>
          </div>
        )}
      </section>

      {/* Create form */}
      <section className="neon-card p-5">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h3 className="font-display font-extrabold text-sm text-slate-900">
            {editingId ? 'Edit Banner' : 'New Banner'}
          </h3>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="neon-btn-ghost px-3 py-1.5 text-[11px]">
              <X className="w-3.5 h-3.5" />
              Cancel edit
            </button>
          )}
        </div>
        <form ref={formRef} onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NeonField label="Banner image URL" className="md:col-span-3">
            <p className="text-[10px] text-slate-500 mb-1">
              Use a fully-designed artwork (headline, players and logos baked into the image — no
              app text is drawn over it).{' '}
              <strong>8:3 landscape</strong>: <strong>1280 × 480 px</strong> recommended (640 × 240
              minimum), JPG/WebP, under ~300 KB.
            </p>
            <div className="flex items-center gap-2">
              <NeonInput
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                placeholder="https://i.ibb.co/your-banner.png"
              />
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-12 h-8 rounded-lg object-cover border border-white/60 shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
              ) : (
                <span className="w-12 h-8 rounded-lg neu-inset-sm shrink-0" aria-hidden="true" />
              )}
            </div>
          </NeonField>
          <NeonField label="Sport">
            <NeonSelect value={form.sport} onChange={(e) => set('sport', e.target.value)}>
              {['football', 'basketball', 'tennis', 'boxing', 'f1', 'cricket', 'mma', 'golf'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </NeonSelect>
          </NeonField>
          <NeonField label="Opens this live event on tap" className="md:col-span-2">
            <NeonSelect value={form.targetEventId} onChange={(e) => set('targetEventId', e.target.value)}>
              <option value="">None (decorative, not clickable)</option>
              {liveEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.homeTeam} vs {ev.awayTeam}
                </option>
              ))}
            </NeonSelect>
          </NeonField>
          <div className="md:col-span-3 flex items-center justify-between gap-3">
            <p className="text-[10.5px] text-slate-500 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" /> Banners are image-only — no headline or CTA text is overlaid.
            </p>
            <button type="submit" disabled={busy} className="neon-btn px-5 py-2 text-xs disabled:opacity-60">
              {editingId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Publish Banner'}
            </button>
          </div>
        </form>
      </section>

      {/* Banner list */}
      <section className="space-y-3">
        <h3 className="font-display font-extrabold text-sm text-slate-900 px-1">
          Published Banners <span className="text-slate-500">({banners.length})</span>
        </h3>
        {banners.length === 0 ? (
          <div className="neon-card p-6 text-center text-xs text-slate-500">No custom banners yet.</div>
        ) : (
          banners.map((b) => {
            const target = liveEvents.find((e) => e.id === b.targetEventId);
            return (
              <div key={b.id} className="neon-row p-3 flex items-center gap-3 flex-wrap">
                {b.imageUrl ? (
                  <img
                    src={b.imageUrl}
                    alt=""
                    className="w-16 h-10 rounded-lg border border-white/40 object-cover shrink-0"
                  />
                ) : (
                  <span className="w-16 h-10 rounded-lg border border-white/15 bg-slate-200 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-xs text-slate-900 truncate">
                      {b.imageUrl ? 'Image banner' : 'No image (legacy)'}
                    </span>
                    <span className="neon-badge">{b.sport}</span>
                    {target ? (
                      <span className="neon-badge">→ {target.homeTeam} vs {target.awayTeam}</span>
                    ) : (
                      <span className="neon-badge">no target</span>
                    )}
                    {!b.enabled && <span className="neon-badge">off</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(b)}
                    className={`neon-btn-ghost px-2.5 py-1.5 ${editingId === b.id ? 'neon-btn-accent' : ''}`}
                    aria-label="Edit banner"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <NeonToggle on={b.enabled} onChange={(next) => toggle(b.id, next)} label="Enable banner" />
                  <button type="button" onClick={() => remove(b.id)} className="neon-btn-ghost neon-btn-danger px-2.5 py-1.5" aria-label="Delete banner">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};
