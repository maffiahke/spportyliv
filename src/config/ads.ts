import {
  AD_PLACEMENT_IDS,
  type AdPlacementId,
  type AdsSettings,
} from '../types/iptv';

/** Publisher id baked in at build time; the admin setting overrides it. */
export const ENV_AD_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT ?? '').trim();

/** Test ads keep preview clicks away from the real account. */
export const AD_TEST_MODE =
  import.meta.env.DEV || import.meta.env.VITE_ADSENSE_TEST === '1';

export interface AdPlacementMeta {
  id: AdPlacementId;
  label: string;
  /** Where it appears — shown in the admin console. */
  hint: string;
  /** AdSense `data-ad-format`. `horizontal` keeps banners ~90-100px tall. */
  format: 'auto' | 'fluid' | 'rectangle' | 'horizontal';
  /** Reserved height in px (mobile, desktop) to keep CLS at zero. */
  reserve: { mobile: number; desktop: number };
  /** Desktop-only placements are not requested below 1024px. */
  desktopOnly?: boolean;
}

export const AD_PLACEMENT_META: AdPlacementMeta[] = [
  {
    id: 'global-leaderboard',
    label: 'Header leaderboard',
    hint: 'Under the header on every content view (not on the player).',
    format: 'horizontal',
    reserve: { mobile: 100, desktop: 100 },
  },
  {
    id: 'home-top',
    label: 'Home — top',
    hint: 'Below the hero and sport row, above Live Now.',
    format: 'horizontal',
    reserve: { mobile: 100, desktop: 100 },
  },
  {
    id: 'home-infeed',
    label: 'Home — in feed',
    hint: 'After the Live Now row, before Upcoming.',
    format: 'rectangle',
    reserve: { mobile: 250, desktop: 250 },
  },
  {
    id: 'home-rail',
    label: 'Home — side rail',
    hint: 'Right column on desktop only.',
    format: 'rectangle',
    reserve: { mobile: 0, desktop: 250 },
    desktopOnly: true,
  },
  {
    id: 'tv-shelf',
    label: 'Live TV — between shelves',
    hint: 'After Featured Channels, before Popular.',
    format: 'horizontal',
    reserve: { mobile: 100, desktop: 100 },
  },
  {
    id: 'fixtures-divider',
    label: 'Fixtures — divider',
    hint: 'Between date groups.',
    format: 'horizontal',
    reserve: { mobile: 100, desktop: 100 },
  },
  {
    id: 'profile-rail',
    label: 'Profile — beside stats',
    hint: 'Desktop and tablet only, never on auth screens.',
    format: 'rectangle',
    reserve: { mobile: 0, desktop: 250 },
    desktopOnly: true,
  },
];

export const AD_META_BY_ID: Record<AdPlacementId, AdPlacementMeta> = Object.fromEntries(
  AD_PLACEMENT_META.map((meta) => [meta.id, meta]),
) as Record<AdPlacementId, AdPlacementMeta>;

/** Effective publisher id: admin override, else the build-time env value. */
export function resolveAdClient(ads?: AdsSettings | null): string {
  const fromSettings = (ads?.publisherId ?? '').trim();
  if (/^ca-pub-\d+$/.test(fromSettings)) return fromSettings;
  return ENV_AD_CLIENT;
}

export interface ResolvedAd {
  client: string;
  slotId: string;
  meta: AdPlacementMeta;
}

/**
 * Everything the renderer needs for one placement, or null when this unit
 * should not be shown (master switch off, slot off, missing ids).
 */
export function resolveAd(
  ads: AdsSettings | null | undefined,
  placement: AdPlacementId,
): ResolvedAd | null {
  if (!ads?.enabled) return null;
  const slot = ads.slots?.[placement];
  if (!slot?.enabled || !slot.slotId.trim()) return null;
  const client = resolveAdClient(ads);
  if (!client) return null;
  const meta = AD_META_BY_ID[placement];
  if (!meta) return null;
  return { client, slotId: slot.slotId.trim(), meta };
}

/** All placements enabled in settings (used by the admin preview). */
export function enabledPlacements(ads: AdsSettings | null | undefined): AdPlacementId[] {
  if (!ads?.enabled) return [];
  return AD_PLACEMENT_IDS.filter((id) => ads.slots?.[id]?.enabled);
}

/**
 * The alternative-network (Monetag/Adsterra) zone code for one placement, or
 * null. It only applies when the AdSense unit for that slot is missing or
 * AdSense is off — AdSense stays the default network.
 */
export function resolveAltSlot(
  ads: AdsSettings | null | undefined,
  placement: AdPlacementId,
): string | null {
  if (!ads?.enabled) return null;
  if (resolveAd(ads, placement)) return null;
  const alt = ads.altSlots?.[placement];
  if (!alt?.enabled) return null;
  const code = alt.code.trim();
  return code ? code : null;
}
