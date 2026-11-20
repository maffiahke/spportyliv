import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { resolveAd } from '../../config/ads';
import type { AdPlacementId, AdsSettings } from '../../types/iptv';

/**
 * Per-view ad budget.
 *
 * Candidates are listed in priority order; the provider keeps the first
 * `ads.maxPerPage` units that are actually configured and allowed at the
 * current breakpoint. Every `AdSlot` inside reads the resulting set, so the
 * cap applies across components (header leaderboard + a tab's own units)
 * instead of per component.
 */
const AdBudgetContext = createContext<ReadonlySet<AdPlacementId> | null>(null);

const DESKTOP_QUERY = '(min-width: 1024px)';

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

interface AdBudgetProviderProps {
  ads?: AdsSettings | null;
  /** Placements for the current view, highest value first. */
  candidates: AdPlacementId[];
  children: React.ReactNode;
}

export const AdBudgetProvider: React.FC<AdBudgetProviderProps> = ({
  ads,
  candidates,
  children,
}) => {
  const isDesktop = useIsDesktop();
  // Stable dependency: callers build the array inline on every render.
  const candidateKey = candidates.join('|');

  const allowed = useMemo(() => {
    const allowedIds = new Set<AdPlacementId>();
    const max = Math.max(0, ads?.maxPerPage ?? 3);
    if (!ads?.enabled || max === 0) return allowedIds;
    for (const id of candidateKey.split('|') as AdPlacementId[]) {
      if (allowedIds.size >= max) break;
      if (!id) continue;
      const resolved = resolveAd(ads, id);
      if (!resolved) continue;
      if (resolved.meta.desktopOnly && !isDesktop) continue;
      allowedIds.add(id);
    }
    return allowedIds;
  }, [ads, candidateKey, isDesktop]);

  return <AdBudgetContext.Provider value={allowed}>{children}</AdBudgetContext.Provider>;
};

/**
 * Whether this placement is within the view budget. Components rendered
 * outside a provider (e.g. the admin console) get `true` and rely on
 * `AdSlot`'s own configuration check.
 */
export function useAdAllowed(placement: AdPlacementId): boolean {
  const allowed = useContext(AdBudgetContext);
  if (!allowed) return true;
  return allowed.has(placement);
}
