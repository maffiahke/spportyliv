import React, { useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  Building2,
  CheckCircle2,
  Clock,
  Facebook,
  Globe,
  Instagram,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Radio,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Twitter,
  Users,
  Youtube,
} from 'lucide-react';
import {
  DEFAULT_ADS_SETTINGS,
  SiteSettings,
  type AdNetworkKind,
  type AdPlacementId,
  type AdsSettings,
} from '../../types/iptv';
import { AD_PLACEMENT_META } from '../../config/ads';
import { updateSettings } from '../../lib/api';
import { NeonField, NeonInput, NeonTextarea, NeonToggle, Spinner } from './ui';

/** Accepts a full t.me URL or an @handle and returns a usable link. */
export function telegramLink(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://t.me/${v.replace(/^@/, '')}`;
}

interface SettingsTabProps {
  settings: SiteSettings;
  onSaved: (next: SiteSettings) => void;
  onToast: (msg: string, error?: boolean) => void;
}

const Section: React.FC<{
  icon: React.ElementType;
  title: string;
  hint: string;
  children: React.ReactNode;
  cols?: string;
}> = ({ icon: Icon, title, hint, children, cols = 'sm:grid-cols-2' }) => (
  <section className="neon-card p-4 sm:p-5 space-y-3.5">
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1D6BFF] to-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-[2px_2px_7px_rgba(29,107,255,0.35)]">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <h3 className="font-display font-extrabold text-xs text-slate-950 leading-tight">{title}</h3>
        <p className="text-[10px] text-slate-500 leading-tight">{hint}</p>
      </div>
    </div>
    <div className={`grid grid-cols-1 ${cols} gap-3`}>{children}</div>
  </section>
);

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSaved, onToast }) => {
  const [draft, setDraft] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings]
  );

  const set = (key: keyof SiteSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const next = await updateSettings(draft);
      onSaved(next);
      onToast('Settings saved — public site updated');
    } catch (err) {
      onToast(`Save failed: ${(err as Error).message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const adsDraft: AdsSettings = draft.ads ?? DEFAULT_ADS_SETTINGS;

  const patchAds = (patch: Partial<AdsSettings>) =>
    setDraft((prev) => ({
      ...prev,
      ads: { ...(prev.ads ?? DEFAULT_ADS_SETTINGS), ...patch },
    }));

  const patchAdSlot = (id: AdPlacementId, patch: Partial<{ enabled: boolean; slotId: string }>) =>
    setDraft((prev) => {
      const base = prev.ads ?? DEFAULT_ADS_SETTINGS;
      const current = base.slots?.[id] ?? { enabled: false, slotId: '' };
      return {
        ...prev,
        ads: { ...base, slots: { ...base.slots, [id]: { ...current, ...patch } } },
      };
    });

  const patchAltSlot = (id: AdPlacementId, patch: Partial<{ enabled: boolean; code: string }>) =>
    setDraft((prev) => {
      const base = prev.ads ?? DEFAULT_ADS_SETTINGS;
      const current = base.altSlots?.[id] ?? { enabled: false, code: '' };
      return {
        ...prev,
        ads: { ...base, altSlots: { ...base.altSlots, [id]: { ...current, ...patch } } },
      };
    });

  const patchPageScript = (kind: AdNetworkKind, patch: Partial<{ enabled: boolean; url: string }>) =>
    setDraft((prev) => {
      const base = prev.ads ?? DEFAULT_ADS_SETTINGS;
      const current = base.pageScripts?.[kind] ?? { enabled: false, url: '' };
      return {
        ...prev,
        ads: { ...base, pageScripts: { ...base.pageScripts, [kind]: { ...current, ...patch } } },
      };
    });

  const contactRows = [
    { icon: Mail, value: draft.supportEmail, href: `mailto:${draft.supportEmail}` },
    { icon: Phone, value: draft.supportPhone, href: `tel:${draft.supportPhone}` },
    { icon: MessageCircle, value: draft.whatsapp, href: `https://wa.me/${draft.whatsapp.replace(/\D/g, '')}` },
    { icon: Globe, value: draft.website, href: draft.website },
    { icon: Send, value: draft.telegram, href: telegramLink(draft.telegram) },
    { icon: Radio, value: draft.telegramChannel, href: telegramLink(draft.telegramChannel) },
    { icon: Users, value: draft.telegramGroup, href: telegramLink(draft.telegramGroup) },
    { icon: MapPin, value: draft.address, href: '' },
  ].filter((r) => r.value.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* Header / save bar */}
      <div className="neon-card neon-card-accent p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display font-extrabold text-sm text-slate-950 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1D6BFF]" />
            Site Settings
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Contact details, branding and footer info shown across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft(settings)}
            disabled={!dirty || saving}
            className="neon-btn-ghost px-3.5 py-2 text-[11px] disabled:opacity-40 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="neon-btn-accent px-4 py-2 text-[11px] disabled:opacity-50 cursor-pointer"
          >
            {saving ? <Spinner /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-8 space-y-4">
          <Section icon={Building2} title="Brand" hint="Name and tagline used across the app">
            <NeonField label="Site name">
              <NeonInput value={draft.siteName} onChange={set('siteName')} placeholder="SportyLive" />
            </NeonField>
            <NeonField label="Tagline">
              <NeonInput value={draft.tagline} onChange={set('tagline')} placeholder="Live sports, every match" />
            </NeonField>
          </Section>

          <Section
            icon={Megaphone}
            title="Monetization (AdSense + networks)"
            hint="Placements update live on the public site — no redeploy"
            cols="grid-cols-1"
          >
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-display font-bold text-[11px] text-slate-950">Enable monetization</p>
                <p className="text-[10px] text-slate-500">
                  Master switch. When off, no ad network (AdSense, Monetag, Adsterra) loads at all.
                </p>
              </div>
              <NeonToggle
                on={adsDraft.enabled}
                onChange={(next) => patchAds({ enabled: next })}
                label="Enable monetization"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NeonField label="Publisher id">
                <NeonInput
                  value={adsDraft.publisherId}
                  onChange={(e) => patchAds({ publisherId: e.target.value })}
                  placeholder="ca-pub-1234567890123456"
                />
              </NeonField>
              <NeonField label="Max units per page">
                <NeonInput
                  type="number"
                  min={0}
                  max={6}
                  value={adsDraft.maxPerPage}
                  onChange={(e) => patchAds({ maxPerPage: Number(e.target.value) })}
                />
              </NeonField>
            </div>

            {adsDraft.publisherId.trim() &&
              !/^ca-pub-\d{8,20}$/.test(adsDraft.publisherId.trim()) && (
                <p className="text-[10px] font-semibold text-rose-600">
                  Publisher id must look like ca-pub-1234567890123456, otherwise ads stay off.
                </p>
              )}

            <p className="text-[10px] leading-relaxed text-slate-500">
              <code className="font-semibold">/ads.txt</code> is generated from this publisher id
              (or <code className="font-semibold">VITE_ADSENSE_CLIENT</code>) automatically.
            </p>

            {/* Alternative networks — site-wide scripts */}
            <div className="rounded-xl border border-[#1D6BFF]/25 bg-[#1D6BFF]/5 px-3 py-2.5 space-y-2">
              <p className="font-display font-extrabold text-[11px] text-slate-950">
                Alternative networks — site-wide
              </p>
              <p className="text-[10px] leading-relaxed text-slate-500">
                Paste the script src from the network dashboard. These run across the whole site
                (Monetag MultiTag, Adsterra Social Bar) and place their own formats.
              </p>
              {([
                ['monetag', 'Monetag', 'MultiTag script src, e.g. https://…/tag.min.js'],
                ['adsterra', 'Adsterra', 'Social Bar script src, e.g. //…/invite.js'],
              ] as [AdNetworkKind, string, string][]).map(([kind, label, hint]) => {
                const script = adsDraft.pageScripts?.[kind] ?? { enabled: false, url: '' };
                return (
                  <div key={kind} className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white/70 px-3 py-2.5">
                    <NeonToggle
                      on={script.enabled}
                      onChange={(next) => patchPageScript(kind, { enabled: next })}
                      label={label}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-[11px] text-slate-950">{label}</p>
                      <p className="text-[10px] text-slate-500">{hint}</p>
                    </div>
                    <NeonInput
                      className="w-full sm:w-72"
                      value={script.url}
                      onChange={(e) => patchPageScript(kind, { url: e.target.value })}
                      placeholder="Script src URL"
                    />
                  </div>
                );
              })}
              <p className="text-[10px] leading-relaxed text-slate-500">
                {adsDraft.consentRequired
                  ? 'Gated by the same consent prompt as AdSense.'
                  : 'Consent is off — these scripts load immediately.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-display font-bold text-[11px] text-slate-950">Require consent</p>
                <p className="text-[10px] text-slate-500">
                  EEA/UK: hold the Google script until a consent signal is present.
                </p>
              </div>
              <NeonToggle
                on={adsDraft.consentRequired}
                onChange={(next) => patchAds({ consentRequired: next })}
                label="Require consent"
              />
            </div>

            <div className="space-y-2">
              {AD_PLACEMENT_META.map((meta) => {
                const slot = adsDraft.slots?.[meta.id] ?? { enabled: false, slotId: '' };
                const altSlot = adsDraft.altSlots?.[meta.id] ?? { enabled: false, code: '' };
                return (
                  <div
                    key={meta.id}
                    className="flex flex-wrap items-center gap-2.5 rounded-xl bg-white/70 px-3 py-2.5"
                  >
                    <NeonToggle
                      on={slot.enabled}
                      onChange={(next) => patchAdSlot(meta.id, { enabled: next })}
                      label={meta.label}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-[11px] text-slate-950">{meta.label}</p>
                      <p className="text-[10px] text-slate-500">{meta.hint}</p>
                    </div>
                    <NeonInput
                      className="w-full sm:w-44"
                      value={slot.slotId}
                      onChange={(e) => patchAdSlot(meta.id, { slotId: e.target.value })}
                      placeholder="AdSense unit id (digits)"
                    />
                    <NeonToggle
                      on={altSlot.enabled}
                      onChange={(next) => patchAltSlot(meta.id, { enabled: next })}
                      label="Alternative network"
                    />
                    <NeonTextarea
                      className="w-full"
                      rows={3}
                      value={altSlot.code}
                      onChange={(e) => patchAltSlot(meta.id, { code: e.target.value })}
                      placeholder="Monetag / Adsterra zone code (used when no AdSense unit id is set) — paste the snippet exactly as provided"
                    />
                    {slot.slotId.trim() && !/^\d{6,20}$/.test(slot.slotId.trim()) && (
                      <p className="w-full text-[10px] font-semibold text-rose-600">
                        AdSense unit ids are numeric — copy the value from AdSense → Ads → By ad unit.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] leading-relaxed text-slate-500">
              Each placement prefers AdSense; the alternative-network code takes over whenever the
              AdSense unit id is empty or AdSense is disabled — so the two networks act as drop-in
              fallbacks for every banner position.
            </p>

            <p className="text-[10px] leading-relaxed text-slate-500">
              Ads never render on the player, PiP, admin or auth screens. Player pages are
              excluded on purpose: AdSense prohibits units that interfere with video and
              does not approve unlicensed streaming content.
            </p>
          </Section>

          <Section icon={AtSign} title="Contact" hint="Shown in the footer and support links">
            <NeonField label="Support email">
              <NeonInput
                type="email"
                value={draft.supportEmail}
                onChange={set('supportEmail')}
                placeholder="support@sportylive.app"
              />
            </NeonField>
            <NeonField label="Support phone">
              <NeonInput value={draft.supportPhone} onChange={set('supportPhone')} placeholder="+1 555 010 2030" />
            </NeonField>
            <NeonField label="WhatsApp number">
              <NeonInput value={draft.whatsapp} onChange={set('whatsapp')} placeholder="+1 555 010 2030" />
            </NeonField>
            <NeonField label="Telegram handle">
              <NeonInput value={draft.telegram} onChange={set('telegram')} placeholder="@sportylive" />
            </NeonField>
            <NeonField label="Telegram channel">
              <NeonInput
                value={draft.telegramChannel}
                onChange={set('telegramChannel')}
                placeholder="@sportylive_channel"
              />
            </NeonField>
            <NeonField label="Telegram group">
              <NeonInput
                value={draft.telegramGroup}
                onChange={set('telegramGroup')}
                placeholder="@sportylive_chat"
              />
            </NeonField>
            <NeonField label="Website">
              <NeonInput value={draft.website} onChange={set('website')} placeholder="https://sportylive.app" />
            </NeonField>
            <NeonField label="Support hours">
              <NeonInput value={draft.hours} onChange={set('hours')} placeholder="24/7 live support" />
            </NeonField>
            <NeonField label="Address" className="sm:col-span-2">
              <NeonInput value={draft.address} onChange={set('address')} placeholder="Street, city, country" />
            </NeonField>
          </Section>

          <Section icon={Twitter} title="Social Profiles" hint="Links rendered as icons in the footer" cols="sm:grid-cols-2">
            <NeonField label="X / Twitter">
              <NeonInput value={draft.twitter} onChange={set('twitter')} placeholder="https://x.com/sportylive" />
            </NeonField>
            <NeonField label="Instagram">
              <NeonInput value={draft.instagram} onChange={set('instagram')} placeholder="https://instagram.com/sportylive" />
            </NeonField>
            <NeonField label="Facebook">
              <NeonInput value={draft.facebook} onChange={set('facebook')} placeholder="https://facebook.com/sportylive" />
            </NeonField>
            <NeonField label="YouTube">
              <NeonInput value={draft.youtube} onChange={set('youtube')} placeholder="https://youtube.com/@sportylive" />
            </NeonField>
          </Section>

          <Section icon={Globe} title="Footer" hint="Fine print and copyright line" cols="grid-cols-1">
            <NeonField label="Footer note">
              <NeonTextarea
                rows={2}
                value={draft.footerNote}
                onChange={set('footerNote')}
                placeholder="Streams are provided by third-party IPTV sources."
              />
            </NeonField>
            <NeonField label="Copyright">
              <NeonInput
                value={draft.copyright}
                onChange={set('copyright')}
                placeholder={`© ${new Date().getFullYear()} SportyLive. All rights reserved.`}
              />
            </NeonField>
          </Section>
        </div>

        {/* Live footer preview */}
        <div className="xl:col-span-4 space-y-3 xl:sticky xl:top-4">
          <h3 className="font-display font-extrabold text-sm text-slate-900 px-1 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1D6BFF]" />
            Footer preview
          </h3>
          <div className="neon-card p-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1D6BFF] to-[#7C3AED] text-white flex items-center justify-center font-display font-extrabold text-sm">
                {(draft.siteName || 'S').trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="font-display font-extrabold text-xs text-slate-950 truncate">
                  {draft.siteName || 'SportyLive'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{draft.tagline || 'No tagline set'}</p>
              </div>
            </div>

            {contactRows.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {contactRows.map(({ icon: Icon, value }) => (
                  <li key={value} className="flex items-center gap-2 text-[11px] text-slate-600">
                    <Icon className="w-3.5 h-3.5 text-[#1D6BFF] shrink-0" />
                    <span className="truncate">{value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-slate-400">Add contact details to populate the footer.</p>
            )}

            {draft.hours.trim() && (
              <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-slate-500">
                <Clock className="w-3 h-3" />
                {draft.hours}
              </p>
            )}

            <div className="mt-3 flex items-center gap-1.5">
              {[
                { icon: Twitter, url: draft.twitter },
                { icon: Instagram, url: draft.instagram },
                { icon: Facebook, url: draft.facebook },
                { icon: Youtube, url: draft.youtube },
              ]
                .filter((s) => s.url.trim())
                .map(({ icon: Icon, url }, i) => (
                  <span
                    key={i}
                    className="w-6 h-6 rounded-lg neu-inset-sm flex items-center justify-center text-slate-500"
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                ))}
            </div>

            {draft.footerNote.trim() && (
              <p className="mt-3 text-[10px] text-slate-400 leading-snug border-t border-[#DCE8FA] pt-2">
                {draft.footerNote}
              </p>
            )}
            <p className="mt-1.5 text-[9.5px] text-slate-400">
              {draft.copyright.trim() || `© ${new Date().getFullYear()} ${draft.siteName || 'SportyLive'}`}
            </p>
          </div>
          <p className="px-1 text-[10px] text-slate-400">
            {settings.updatedAt
              ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}`
              : 'Never saved from this panel yet.'}
          </p>
        </div>
      </div>
    </div>
  );
};
