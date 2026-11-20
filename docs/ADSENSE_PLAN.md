# AdSense plan — global placements without breaking layout

> **Status:** Phases 1–3 implemented. Loader, `AdSlot`, per-view budget,
> seven placements (header leaderboard, home top/in-feed/rail, TV shelf,
> fixtures divider, profile rail), first-party consent prompt, admin
> Monetization panel and dynamic `/ads.txt`. Measured on the dev server: 100px
> banners (`horizontal`), 250px rectangles, zero Google requests while disabled,
> zero ad markup on the player. Phase 4 (house ads) remains optional.

## 0. Read this first (risk)

AdSense review is automated and strict. Two things in this app are likely to
block approval regardless of how clean the integration is:

1. **Ad code on streaming pages.** Google prohibits placing ads on pages that
   distribute content you don't have rights to. An IPTV aggregator with
   unlicensed channels/feeds is the classic rejection/ban case (`Site does not
   comply with Google policies`).
2. **Thin/duplicate content.** Pages that are mostly a player with no
   editorial text also get rejected.

Practical consequence: keep AdSense units **off player pages** and on
content-bearing pages only (home, fixtures, channel directory, profile), or use
**first-party sponsor slots** (same component, `kind: 'house'`) where the risk
is unacceptable. The architecture below supports both, so the decision is a
settings toggle, not a rewrite.

## 1. What exists today (constraints the design must respect)

- Vite SPA (`index.html` → `src/App.tsx`), tabs `home | live-tv | fixtures |
  profile`, player replaces the whole `<main>` (`PlayerScreen.tsx`), mobile
  bottom nav is `fixed bottom-0`, PiP player sits above it.
- Layout: `<main class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4">`.
  Home is a 12-col grid (`lg:grid-cols-12`) with a right rail; live matches are a
  horizontal snap-scroller on small screens and a 2-col grid on `xl`.
- Content is **realtime**: SSE `/api/events` → refetch → `content` state
  replaced. Any ad `<ins>` inside a re-rendered list subtree would be unmounted
  and re-pushed, which Google treats as a broken unit ("All ins elements … already
  have ads").
- Settings are a JSONB doc in Neon (`settings` table, no migration needed for
  new fields) and already stream to clients — so ad toggles can be admin-managed
  and propagate live.
- Deploy: Vercel CDN + one serverless function; `dist/` is the CDN root, so
  `public/ads.txt` is served at `/ads.txt` (filesystem beats the SPA rewrite).

## 2. Architecture

```
src/lib/adsense.ts          one-time script loader + push helper + consent store
src/config/ads.ts           build-time client id, slot map, placeholder sizes
src/components/ads/AdSlot.tsx     the only thing pages import
src/components/ads/AdBudget.tsx   per-view cap + desktop-only gate
src/components/ads/AdsConsentBanner.tsx  first-party EEA/UK prompt
src/types/iptv.ts (SiteSettings)  ads: { enabled, publisherId, slots, ... }
src/components/admin/SettingsTab.tsx  "Monetization" section
server/api.ts               dynamic /ads.txt (publisher id from settings/env)
vercel.json                 /ads.txt rewrite before the SPA fallback
```

### 2.1 `SiteSettings.ads` (runtime control, no redeploy)

```ts
ads?: {
  enabled: boolean;                        // master switch
  publisherId?: string;                    // ca-pub-… override of VITE_ADSENSE_CLIENT
  slots: Record<AdPlacementId, { enabled: boolean; slotId: string }>;
  maxPerPage: number;                      // hard cap, default 3
  consentRequired: boolean;                // EEA/UK: wait for CMP
};
```

Defaults in `DEFAULT_SITE_SETTINGS`, all slots `enabled: false` so nothing
ships live until the publisher id and slot ids are filled in. Because it lives
in the settings JSONB doc, `bun run db:migrate` is **not** needed.

### 2.2 `AdSlot.tsx` — placement-safe by construction

- Props: `placement` (id from the map), `format` (`leaderboard | inFeed |
  rectangle | inArticle`), optional `className`, `reserve` (min-height map).
- Renders:

```tsx
<section aria-label="Advertisement" className={...}>
  <label>Advertisement</label>
  <ins className="adsbygoogle block w-full"
       data-ad-client={client} data-ad-slot={slotId}
       data-ad-format={format === 'inFeed' ? 'fluid' : 'auto'}
       data-full-width-responsive="true"
       style={{ display: 'block', minHeight: reserve }} />
</section>
```

- **Reserve height** prevents CLS: `90px` (< 768px), `100px` (≥ 768), `250px`
  for rectangles; use `min-h-[…]` via a lookup table, not fixed `height`, so
  fluid units can grow on large screens.
- Push once per mount: `useEffect(() => { if (ready && !ref.current.dataset.filled) pushAd() }, [ready])`
  Guarded by a `filled` flag and the loader promise; safe under React 19
  StrictMode double-invocation and SSE-driven re-renders (slot mounts once,
  outside list subtrees).
- When `enabled` is false or no publisher id: render a dashed placeholder with
  the same reserved height (layout identical in dev / pre-approval), no script
  load at all.
- `data-adtest="on"` injected in dev and on Vercel **preview** deployments so
  test clicks never count.

### 2.3 `src/lib/adsense.ts` — one script, lazy, idempotent

- Inject `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…`
  once (`crossorigin="anonymous"`), **after first paint** (`requestIdleCallback`
  with a 2s timeout) so it never blocks LCP.
- Resolve a shared promise when the script's `onload` fires; `pushAd()` awaits
  it then calls `adsbygoogle.push({})` — never `push` before the script exists
  (that's the "adsbygoogle is not defined" error).
- Consent gate: if `consentRequired` and no `window.__adConsent` flag, the
  loader resolves without loading the script and `AdSlot` keeps the placeholder.
- No auto ads (`<script>` with `data-auto-ads` omitted): Auto Ads places anchor
  units that collide with the fixed mobile nav and the PiP player. Explicit
  slots only.

## 3. Placement map (global, but deliberate)

| View | Placement | Format / size | Breakpoints |
| --- | --- | --- | --- |
| All content views (header zone) | `global-leaderboard`, directly under `<header>`, inside `max-w-7xl px-3.5 sm:px-6 lg:px-8` | 320x100 → 970x90 | every view except player & auth |
| Home — after hero + sport row, before "Live Now" | `home-top` | inArticle / auto | all |
| Home — after the first live-match row (sibling of the scroller, never inside it) | `home-infeed` | fluid in-feed | all; on `lg+` sits after the first grid row |
| Home — right rail, sticky under the upcoming card (`lg:grid-cols-12` column) | `home-rail` | 300x250 | **lg+ only** |
| Live TV — between Featured and Popular shelves | `tv-shelf` | inArticle | all |
| Fixtures — after the second date group | `fixtures-divider` | auto | all |
| Profile — beside the stats/reminder column | `profile-rail` | 300x250 | `md+`; hidden on auth screens |
| **Player / PiP** | **none** — policy + interference with video | — | — |
| Admin console | none (policy: no ads on admin/tool pages) | — | — |

Rules enforced in code, not by convention:

- **Max 3 units** visible in a viewport (`maxPerPage`), counted per tab; the
  sidebar unit is desktop-only so mobile stays at 2.
- Never inside `.overflow-x-auto` / snap scrollers, never inside `.map()` lists
  that the SSE refetch replaces. Slots are siblings of the sections.
- No unit within 150px of the fixed mobile nav or the PiP strip; both reserve
  their own space (`pb-[max(...safe-area)]` already exists).
- No ads on `/admin*`, `/admin/login`, sign-in/sign-up overlays, or empty
  states (no channels, no fixtures).
- One "Advertisement" label per slot, small caps, `text-[10px] text-slate-500`,
  matching the existing design vocabulary.

## 4. Responsive behaviour

- Widths are fluid: `<ins class="w-full">` inside the page container, so the
  unit matches `max-w-7xl` on desktop and full width minus `px-3.5` on mobile.
  AdSense's `data-full-width-responsive="true"` adapts the creative.
- **Format choice keeps the height honest.** `auto` lets Google serve tall
  creatives (a 680px-wide unit rendered 280px tall in test), which shifts
  everything below it. Banner placements therefore use
  `data-ad-format="horizontal"` (measured 100px at 375 / 764 / 1280 viewport
  widths) and the in-feed unit uses `rectangle` with a 250px reserve.
- Reserved heights: 100px banners, 250px in-feed rectangles; the desktop rail
  reserves 250px and only renders at `lg` (`min-width: 1024px`), matching
  `lg:grid-cols-12`. Below that the unit is not requested at all.
- Player view: no ad markup at all, so fullscreen and PiP never fight ads.
- Home scroller: the ad row is rendered **after** the scroller element; the
  scroller keeps its `-mx-1 px-1` bleeding without the unit participating.

## 5. Implementation phases

**Phase 1 — skeleton (done)**
1. `src/lib/adsense.ts`, `src/config/ads.ts`, `src/components/ads/AdSlot.tsx`.
2. Extend `SiteSettings` + `DEFAULT_SITE_SETTINGS`, map `ads` in `server/db.ts`
   settings doc (no schema change).
3. `SettingsTab` → "Monetization" section: master toggle, publisher id, slot ids
   per placement, max-per-page, id validation.
4. Render `global-leaderboard` + `home-infeed` only. Verify placeholders at
   360/768/1024/1440 and Lighthouse CLS = 0.

**Phase 2 — rollout (done)**
5. `home-top`, `tv-shelf`, `fixtures-divider`, `home-rail`, `profile-rail`.
6. Per-view cap enforcement (`AdBudgetProvider`) + "hide when content is empty".
7. Verify ad-blocker path (slots collapse to placeholder, no console errors) and
   the PiP/player path (zero `<ins>` in DOM).

**Phase 3 — go live (done)**
8. `/ads.txt` served dynamically from the admin publisher id (fallback
   `VITE_ADSENSE_CLIENT`); `vercel.json` rewrite keeps the CDN from shadowing it.
9. Vercel env: `VITE_ADSENSE_CLIENT`; AdSense console: auto ads off, anchor and
   vignette off, privacy & messaging (GDPR/EEA CMP) enabled.
10. Test on a preview deploy with `data-adtest="on"`, then flip the admin
    master toggle in production (no redeploy needed).
11. First-party consent prompt (`AdsConsentBanner`) fills units once accepted;
    a certified CMP can set `window.__sportyliveAdsConsent` instead.

**Phase 4 — optional revenue beyond AdSense**
11. `kind: 'house'` variant of `AdSlot` for direct sponsors / affiliate banners
    (`imageUrl`, `href`, `label`), admin-managed like banners. Useful if AdSense
    approval is refused, and it keeps the same layout contract.

## 6. Verification checklist

- [ ] `bun run lint`, `bun run build`, dev at :3000 with no placeholder overflow.
- [ ] Lighthouse (mobile + desktop) on `/`: CLS ≤ 0.01, no ad-related LCP delay.
- [ ] StrictMode / SSE test: trigger an admin edit, confirm the ad iframe is not
      re-created (no `adsbygoogle` "already have ads" console error).
- [ ] Viewport matrix 360 / 414 / 768 / 1024 / 1280 / 1440: unit never wider than
      container, never overlaps bottom nav, rail hidden < 1024.
- [ ] `/player` path: `document.querySelectorAll('ins.adsbygoogle').length === 0`.
- [ ] Ad blocker on: page lays out identically (placeholders), no JS errors.
- [ ] `/ads.txt` returns 200 with the right publisher id on the Vercel domain.
- [ ] Admin master toggle off → no third-party request to googlesyndication.com.

## 7. Files touched (summary)

| File | Change |
| --- | --- |
| `src/types/iptv.ts` | `ads` block on `SiteSettings`, defaults |
| `src/lib/adsense.ts` | new: lazy loader + consent gate + push helper |
| `src/config/ads.ts` | new: client id, placement → slot id map, reserve sizes |
| `src/components/ads/AdSlot.tsx` | new: slot renderer, consent-aware fill |
| `src/components/ads/AdBudget.tsx` | new: per-view cap + desktop-only gate |
| `src/components/ads/AdsConsentBanner.tsx` | new: first-party EEA/UK prompt |
| `src/App.tsx` | mount leaderboard, home top/in-feed/rail, budget provider, consent banner |
| `src/components/LiveTVView.tsx` | shelf divider slot |
| `src/components/FixturesView.tsx` | date-group divider slot |
| `src/components/ProfileView.tsx` | profile rail slot (auth screens excluded) |
| `src/components/admin/SettingsTab.tsx` | Monetization section + id validation |
| `server/api.ts` | dynamic `/ads.txt` from settings / env |
| `server/db.ts` | settings doc already JSONB — `ads` round-trips |
| `vercel.json` | `/ads.txt` rewrite before the SPA fallback |
| `DEPLOY.md` | AdSense env, consent, ads.txt, test mode notes |
