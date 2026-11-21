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

const GRADIENT_PRESETS: Array<[string, string]> = [
  ['Violet Prism', 'linear-gradient(115deg, #2E1065 0%, #7C3AED 48%, #EC4899 100%)'],
  ['Ocean Ice', 'linear-gradient(115deg, #062163 0%, #0F47C7 45%, #092670 100%)'],
  ['Emerald Court', 'linear-gradient(115deg, #064E3B 0%, #047857 50%, #0F172A 100%)'],
  ['Crimson Ring', 'linear-gradient(115deg, #450A0A 0%, #991B1B 50%, #1E293B 100%)'],
  ['Midnight Track', 'linear-gradient(115deg, #0F172A 0%, #991B1B 52%, #020617 100%)'],
  ['Clásico Duel', 'linear-gradient(115deg, #0B256B 0%, #1D4ED8 50%, #7F1D1D 100%)'],
];

interface BannerFormState {
  sport: string;
  headlineTop: string;
  headlineHighlight: string;
  headlineBottom: string;
  subtitleLine1: string;
  subtitleLine2: string;
  ctaLabel: string;
  bgGradient: string;
  imageUrl: string;
  targetEventId: string;
}

const emptyForm = (): BannerFormState => ({
  sport: 'football',
  headlineTop: 'Watch',
  headlineHighlight: 'Live Now',
  headlineBottom: 'in HD!',
  subtitleLine1: '',
  subtitleLine2: '',
  ctaLabel: 'Watch Live',
  bgGradient: GRADIENT_PRESETS[0][1],
  imageUrl: '',
  targetEventId: '',
});

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
    if (!form.headlineHighlight.trim()) {
      onToast('Headline highlight is required', true);
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateBanner(editingId, {
          sport: form.sport,
          headlineTop: form.headlineTop.trim(),
          headlineHighlight: form.headlineHighlight.trim(),
          headlineBottom: form.headlineBottom.trim(),
          subtitleLine1: form.subtitleLine1.trim(),
          subtitleLine2: form.subtitleLine2.trim(),
          ctaLabel: form.ctaLabel.trim() || 'Watch Live',
          bgGradient: form.bgGradient,
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
        headlineTop: form.headlineTop.trim(),
        headlineHighlight: form.headlineHighlight.trim(),
        headlineBottom: form.headlineBottom.trim(),
        subtitleLine1: form.subtitleLine1.trim(),
        subtitleLine2: form.subtitleLine2.trim(),
        ctaLabel: form.ctaLabel.trim() || 'Watch Live',
        bgGradient: form.bgGradient,
        imageUrl: form.imageUrl.trim() || undefined,
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
      headlineTop: b.headlineTop,
      headlineHighlight: b.headlineHighlight,
      headlineBottom: b.headlineBottom,
      subtitleLine1: b.subtitleLine1,
      subtitleLine2: b.subtitleLine2,
      ctaLabel: b.ctaLabel,
      bgGradient: b.bgGradient,
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

  return (
    <div className="space-y-5">
      {/* Live preview strip */}
      <section
        className="neon-card neon-card-accent p-4 relative overflow-hidden min-h-[110px]"
        style={{ background: form.bgGradient }}
      >
        {form.imageUrl.trim() && (
          <>
            <img
              src={form.imageUrl.trim()}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(100deg, rgba(6,15,40,0.88) 0%, rgba(6,15,40,0.55) 55%, rgba(6,15,40,0.2) 100%)' }}
            />
          </>
        )}
        <div className="relative z-10 max-w-[70%]">
          <p className="font-display font-extrabold text-lg leading-tight text-white">
            {form.headlineTop}{' '}
            <span className="italic neon-prisma-text">{form.headlineHighlight}</span>{' '}
            {form.headlineBottom}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-white/80 truncate">
            {form.subtitleLine1 || 'First subtitle line'}
          </p>
          <p className="text-[11px] font-semibold text-white/70 truncate">
            {form.subtitleLine2 || 'Second subtitle line'}
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-display font-extrabold text-slate-900">
            {form.ctaLabel || 'Watch Live'}
          </span>
        </div>
      </section>

      {/* Create form */}
      <section className="neon-card p-5">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <h3 className="font-display font-extrabold text-sm text-slate-900">
            {editingId ? 'Edit Hero Banner' : 'New Hero Banner'}
          </h3>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="neon-btn-ghost px-3 py-1.5 text-[11px]">
              <X className="w-3.5 h-3.5" />
              Cancel edit
            </button>
          )}
        </div>
        <form ref={formRef} onSubmit={submit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NeonField label="Headline (top)">
            <NeonInput value={form.headlineTop} onChange={(e) => set('headlineTop', e.target.value)} placeholder="Watch" />
          </NeonField>
          <NeonField label="Headline (highlight, gradient)">
            <NeonInput value={form.headlineHighlight} onChange={(e) => set('headlineHighlight', e.target.value)} placeholder="Live Now" />
          </NeonField>
          <NeonField label="Headline (bottom)">
            <NeonInput value={form.headlineBottom} onChange={(e) => set('headlineBottom', e.target.value)} placeholder="Anywhere!" />
          </NeonField>
          <NeonField label="Subtitle line 1" className="md:col-span-2">
            <NeonInput value={form.subtitleLine1} onChange={(e) => set('subtitleLine1', e.target.value)} placeholder="Football • Basketball • Tennis" />
          </NeonField>
          <NeonField label="Subtitle line 2" className="md:col-span-2">
            <NeonInput value={form.subtitleLine2} onChange={(e) => set('subtitleLine2', e.target.value)} placeholder="Boxing • and More..." />
          </NeonField>
          <NeonField label="CTA Label">
            <NeonInput value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Go Live" />
          </NeonField>
          <NeonField label="Sport">
            <NeonSelect value={form.sport} onChange={(e) => set('sport', e.target.value)}>
              {['football', 'basketball', 'tennis', 'boxing', 'f1', 'cricket', 'mma', 'golf'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </NeonSelect>
          </NeonField>
          <NeonField label="Links to live event">
            <NeonSelect value={form.targetEventId} onChange={(e) => set('targetEventId', e.target.value)}>
              <option value="">None (decorative)</option>
              {liveEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.homeTeam} vs {ev.awayTeam}
                </option>
              ))}
            </NeonSelect>
          </NeonField>
          <NeonField label="Background image URL (optional)" className="md:col-span-3">
          <p className="text-[10px] text-slate-500 mb-1">
            Best size: <strong>1600 × 534 px (3:1)</strong>, landscape. Keep the subject on the
            right/center — the left side is covered by the headline + dark scrim. Keep text and
            logos out of the middle band (it gets cropped on phones). JPG or WebP, under ~300 KB.
          </p>
            <div className="flex items-center gap-2">
              <NeonInput
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                placeholder="https://images.example.com/hero.jpg"
              />
              {form.imageUrl.trim() ? (
                <img
                  src={form.imageUrl.trim()}
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
          <NeonField label="Background gradient (fallback / scrim)" className="md:col-span-3">
            <div className="flex items-center gap-2 flex-wrap">
              {GRADIENT_PRESETS.map(([label, gradient]) => (
                <button
                  key={label}
                  type="button"
                  title={label}
                  onClick={() => set('bgGradient', gradient)}
                  className={`w-10 h-8 rounded-lg border transition-all cursor-pointer ${
                    form.bgGradient === gradient
                      ? 'border-white ring-2 ring-violet-400/60'
                      : 'border-white/20 hover:border-white/50'
                  }`}
                  style={{ background: gradient }}
                />
              ))}
              <input
                value={form.bgGradient}
                onChange={(e) => set('bgGradient', e.target.value)}
                className="neon-input flex-1 min-w-[200px] font-mono text-[10.5px]"
              />
            </div>
          </NeonField>
          <div className="md:col-span-3 flex items-center justify-between gap-3">
            <p className="text-[10.5px] text-slate-500 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" /> Add an image URL for a photo hero, or a gradient for artwork-only.
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
                    className="w-14 h-9 rounded-lg border border-white/40 object-cover shrink-0"
                  />
                ) : (
                  <span
                    className="w-14 h-9 rounded-lg border border-white/15 shrink-0"
                    style={{ background: b.bgGradient }}
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-xs text-slate-900 truncate">
                      {b.headlineTop} <span className="neon-prisma-text italic">{b.headlineHighlight}</span> {b.headlineBottom}
                    </span>
                    {target ? (
                      <span className="neon-badge">{target.homeTeam} vs {target.awayTeam}</span>
                    ) : (
                      <span className="neon-badge">no target</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-slate-500 truncate">{b.subtitleLine1 || b.subtitleLine2 || b.ctaLabel}</p>
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
