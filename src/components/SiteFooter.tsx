import React from 'react';
import {
  Clock,
  Facebook,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Radio,
  Send,
  Twitter,
  Users,
  Youtube,
} from 'lucide-react';
import { SiteSettings } from '../types/iptv';

const ICON_CLASS = 'w-3.5 h-3.5 shrink-0 text-[#1D6BFF]';

/** Accepts a full t.me URL or an @handle and returns a usable link. */
const telegramLink = (value: string): string => {
  const v = value.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return `https://t.me/${v.replace(/^@/, '')}`;
};

const socialsOf = (s: SiteSettings) =>
  [
    { icon: Twitter, url: s.twitter, label: 'X / Twitter' },
    { icon: Instagram, url: s.instagram, label: 'Instagram' },
    { icon: Facebook, url: s.facebook, label: 'Facebook' },
    { icon: Youtube, url: s.youtube, label: 'YouTube' },
  ].filter((s2) => s2.url.trim().length > 0);

/** Public footer driven entirely by admin-managed site settings. */
export const SiteFooter: React.FC<{ settings: SiteSettings }> = ({ settings }) => {
  const socials = socialsOf(settings);
  const hasContact =
    [
      settings.supportEmail,
      settings.supportPhone,
      settings.whatsapp,
      settings.telegram,
      settings.telegramChannel,
      settings.telegramGroup,
      settings.website,
      settings.address,
    ].filter(
      (v) => v.trim().length > 0,
    ).length > 0;

  if (!hasContact && socials.length === 0 && !settings.footerNote.trim() && !settings.copyright.trim()) {
    return null;
  }

  return (
    <footer className="mt-6 pt-5 border-t border-[#DCE8FA]" aria-label="Site information">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1D6BFF] to-[#7C3AED] text-white flex items-center justify-center font-display font-extrabold text-sm shadow-[3px_3px_9px_rgba(29,107,255,0.3)]">
              {(settings.siteName || 'S').trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-display font-extrabold text-xs text-slate-950 truncate">
                {settings.siteName || 'SportyLive'}
              </p>
              <p className="text-[10px] text-slate-500 truncate">{settings.tagline}</p>
            </div>
          </div>
          {settings.hours.trim() && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-slate-500">
              <Clock className={ICON_CLASS} />
              {settings.hours}
            </p>
          )}
          {socials.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {socials.map(({ icon: Icon, url, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  className="w-7 h-7 rounded-lg neu-surface-sm flex items-center justify-center text-slate-600 hover:text-[#1D6BFF] hover:-translate-y-0.5 transition-all"
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Contact */}
        {hasContact && (
          <div>
            <p className="font-display font-extrabold text-[10px] tracking-[0.08em] text-slate-500 uppercase mb-2">
              Contact
            </p>
            <ul className="space-y-1.5">
              {settings.supportEmail.trim() && (
                <li>
                  <a
                    href={`mailto:${settings.supportEmail}`}
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#1D6BFF]"
                  >
                    <Mail className={ICON_CLASS} />
                    <span className="truncate">{settings.supportEmail}</span>
                  </a>
                </li>
              )}
              {settings.supportPhone.trim() && (
                <li>
                  <a
                    href={`tel:${settings.supportPhone.replace(/\s+/g, '')}`}
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#1D6BFF]"
                  >
                    <Phone className={ICON_CLASS} />
                    <span className="truncate">{settings.supportPhone}</span>
                  </a>
                </li>
              )}
              {settings.whatsapp.trim() && (
                <li>
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#1D6BFF]"
                  >
                    <MessageCircle className={ICON_CLASS} />
                    <span className="truncate">WhatsApp</span>
                  </a>
                </li>
              )}
              {settings.telegram.trim() && (
                <li>
                  <a
                    href={telegramLink(settings.telegram)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#1D6BFF]"
                  >
                    <Send className={ICON_CLASS} />
                    <span className="truncate">{settings.telegram}</span>
                  </a>
                </li>
              )}
              {settings.telegramChannel.trim() && (
                <li>
                  <a
                    href={telegramLink(settings.telegramChannel)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#1D6BFF]"
                  >
                    <Radio className={ICON_CLASS} />
                    <span className="truncate">Telegram Channel</span>
                  </a>
                </li>
              )}
              {settings.telegramGroup.trim() && (
                <li>
                  <a
                    href={telegramLink(settings.telegramGroup)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#1D6BFF]"
                  >
                    <Users className={ICON_CLASS} />
                    <span className="truncate">Telegram Group</span>
                  </a>
                </li>
              )}
              {settings.website.trim() && (
                <li>
                  <a
                    href={settings.website}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-[#1D6BFF]"
                  >
                    <Globe className={ICON_CLASS} />
                    <span className="truncate">{settings.website.replace(/^https?:\/\//, '')}</span>
                  </a>
                </li>
              )}
              {settings.address.trim() && (
                <li className="flex items-start gap-1.5 text-[11px] text-slate-600">
                  <MapPin className={`${ICON_CLASS} mt-0.5`} />
                  <span>{settings.address}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Notice */}
        {settings.footerNote.trim() && (
          <div className="lg:col-span-2">
            <p className="font-display font-extrabold text-[10px] tracking-[0.08em] text-slate-500 uppercase mb-2">
              About
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">{settings.footerNote}</p>
          </div>
        )}
      </div>

      <p className="mt-5 pt-3 border-t border-[#DCE8FA] text-[10px] text-slate-400">
        {settings.copyright.trim() ||
          `© ${new Date().getFullYear()} ${settings.siteName || 'SportyLive'}. All rights reserved.`}
      </p>
    </footer>
  );
};
