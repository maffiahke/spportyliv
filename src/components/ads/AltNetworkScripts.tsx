import React, { useEffect, useState } from 'react';
import { subscribeAdsConsent } from '../../lib/adsense';
import { preloadAltNetworkScript } from '../../lib/altads';
import type { AdNetworkKind, AdsSettings } from '../../types/iptv';

interface AltNetworkScriptsProps {
  /** Admin-managed ad config from site settings. */
  ads?: AdsSettings | null;
}

/**
 * Site-wide alternative-network scripts (Monetag MultiTag, Adsterra Social
 * Bar). Each enabled network gets exactly one script tag per page, injected
 * after first paint and gated by the same consent signal as AdSense. These
 * networks place their own formats (popunders, social bar, interstitials) —
 * there is nothing to render in the layout itself.
 */
export const AltNetworkScripts: React.FC<AltNetworkScriptsProps> = ({ ads }) => {
  const [consentTick, setConsentTick] = useState(0);

  useEffect(() => subscribeAdsConsent(() => setConsentTick((t) => t + 1)), []);

  useEffect(() => {
    if (!ads?.enabled) return;
    const consentRequired = ads.consentRequired !== false;
    const kinds: AdNetworkKind[] = ['monetag', 'adsterra'];
    for (const kind of kinds) {
      const script = ads.pageScripts?.[kind];
      if (!script?.enabled || !script.url.trim()) continue;
      void preloadAltNetworkScript(kind, script.url.trim(), consentRequired);
    }
  }, [ads?.enabled, ads?.consentRequired, ads?.pageScripts?.monetag?.enabled, ads?.pageScripts?.monetag?.url, ads?.pageScripts?.adsterra?.enabled, ads?.pageScripts?.adsterra?.url, consentTick]);

  return null;
};
