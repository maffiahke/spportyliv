import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { AD_PLACEMENT_IDS, type AdsSettings } from '../../types/iptv';
import { resolveAdClient } from '../../config/ads';
import { adsConsentChoice, setAdsConsent } from '../../lib/adsense';

interface AdsConsentBannerProps {
  ads?: AdsSettings | null;
}

/**
 * Minimal first-party consent prompt for EEA/UK traffic.
 *
 * AdSense itself is only loaded after `setAdsConsent(true)`; when the site
 * owner configures a certified CMP (Google's Privacy & Messaging), that CMP
 * sets `window.__sportyliveAdsConsent` and this banner stays hidden.
 */
export const AdsConsentBanner: React.FC<AdsConsentBannerProps> = ({ ads }) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!ads?.enabled) return;
    if (adsConsentChoice() !== null) setDismissed(true);
  }, [ads?.enabled]);

  const hasConfiguredSlot = AD_PLACEMENT_IDS.some((id) => {
    const slot = ads?.slots?.[id];
    return Boolean(slot?.enabled && slot.slotId.trim());
  });

  if (!ads?.enabled || !ads.consentRequired || !hasConfiguredSlot) return null;
  if (!resolveAdClient(ads)) return null;
  if (dismissed || adsConsentChoice() !== null) return null;

  const choose = (granted: boolean) => {
    setAdsConsent(granted);
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label="Ad consent"
      aria-live="polite"
      className="fixed z-50 inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:left-5 lg:bottom-5 lg:max-w-sm"
    >
      <div className="neu-surface rounded-[20px] p-4 space-y-3 shadow-[8px_8px_22px_rgba(163,189,226,0.45),-8px_-8px_22px_rgba(255,255,255,0.95)]">
        <div className="flex items-start gap-2.5">
          <span className="neu-inset-sm w-8 h-8 rounded-full flex items-center justify-center text-[#1D6BFF] shrink-0">
            <Cookie className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-bold text-xs text-slate-950">Ads and cookies</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
              We use Google AdSense to keep SportyLive free. Accept personalised ads,
              or continue with non-personalised ads only.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => choose(true)}
            className="flex-1 rounded-full bg-[#1D6BFF] text-white font-display font-bold text-xs px-3 py-2 min-h-[36px] cursor-pointer shadow-sm hover:bg-[#155BE0] transition-colors"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => choose(false)}
            className="flex-1 neu-surface-sm rounded-full text-slate-700 font-display font-bold text-xs px-3 py-2 min-h-[36px] cursor-pointer hover:text-slate-950 transition-colors"
          >
            Decline
          </button>
        </div>
        <a
          href="https://policies.google.com/technologies/partner-sites"
          target="_blank"
          rel="noreferrer noopener"
          className="block text-center text-[10px] text-slate-500 hover:text-[#1D6BFF] underline underline-offset-2"
        >
          How Google uses data
        </a>
      </div>
    </div>
  );
};
