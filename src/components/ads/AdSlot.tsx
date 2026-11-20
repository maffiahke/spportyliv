import React, { useEffect, useRef, useState } from 'react';
import { AD_META_BY_ID, AD_TEST_MODE, resolveAd } from '../../config/ads';
import { fillAdSlot, subscribeAdsConsent } from '../../lib/adsense';
import type { AdPlacementId, AdsSettings } from '../../types/iptv';
import { useAdAllowed } from './AdBudget';

interface AdSlotProps {
  placement: AdPlacementId;
  /** Admin-managed ad config from site settings. */
  ads?: AdsSettings | null;
  className?: string;
  /** Force the dashed placeholder even when the unit is live (design QA). */
  forcePlaceholder?: boolean;
}

/**
 * One AdSense unit. Mount it as a sibling of content sections — never inside a
 * list that the realtime refetch replaces, or the `<ins>` is re-created and
 * `adsbygoogle.push()` throws.
 *
 * When the unit is not configured the same reserved space is rendered in dev
 * (and on preview deployments) so layout can be reviewed before approval; in
 * production an unconfigured unit renders nothing.
 */
export const AdSlot: React.FC<AdSlotProps> = ({
  placement,
  ads,
  className = '',
  forcePlaceholder = false,
}) => {
  const meta = AD_META_BY_ID[placement];
  const resolved = forcePlaceholder ? null : resolveAd(ads, placement);
  const allowed = useAdAllowed(placement);
  const insRef = useRef<HTMLModElement | null>(null);
  // Re-run the fill effect when the viewer accepts the consent prompt.
  const [consentTick, setConsentTick] = useState(0);

  useEffect(() => subscribeAdsConsent(() => setConsentTick((t) => t + 1)), []);

  useEffect(() => {
    if (!resolved || !allowed || !insRef.current) return;
    void fillAdSlot(insRef.current, resolved.client, ads?.consentRequired !== false);
  }, [resolved?.client, resolved?.slotId, allowed, consentTick, ads?.consentRequired]);

  const reserveStyle = {
    '--ad-h-mobile': `${meta.reserve.mobile}px`,
    '--ad-h-desktop': `${meta.reserve.desktop}px`,
  } as React.CSSProperties;

  // Outside the per-view budget: no markup at all (no placeholder, no request).
  if (resolved && !allowed) return null;

  const showPlaceholder = !resolved && (forcePlaceholder || AD_TEST_MODE || import.meta.env.DEV);
  if (!resolved && !showPlaceholder) return null;

  return (
    <section
      aria-label="Advertisement"
      data-ad-placement={placement}
      className={`ad-slot ${meta.desktopOnly ? 'ad-slot-desktop-only' : ''} ${className}`}
      style={reserveStyle}
    >
      {resolved ? (
        <>
          <span className="ad-slot-label">Advertisement</span>
          <ins
            key={`${resolved.client}-${resolved.slotId}`}
            ref={insRef}
            className="adsbygoogle block w-full"
            data-ad-client={resolved.client}
            data-ad-slot={resolved.slotId}
            data-ad-format={resolved.meta.format}
            data-full-width-responsive="true"
            data-adtest={AD_TEST_MODE ? 'on' : undefined}
            style={{ display: 'block' }}
          />
        </>
      ) : (
        <div className="ad-slot-placeholder">
          <span className="ad-slot-label">Ad space — {meta.label}</span>
          <span className="ad-slot-placeholder-hint">
            {meta.desktopOnly ? 'Desktop only' : 'Responsive'} · configure in Admin → Settings → Monetization
          </span>
        </div>
      )}
    </section>
  );
};
