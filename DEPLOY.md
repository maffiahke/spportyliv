# Deploying SportyLive to Vercel + Neon

## What runs where

| Piece | Host | Notes |
| --- | --- | --- |
| Frontend (`index.html`, `admin.html`, `assets/`) | Vercel CDN | built by `prisma generate && vite build` into `dist/` |
| API (`/api/*`) | Vercel serverless function (`api/index.ts`) | wraps `server/api.ts` in Express |
| Data | Neon Postgres (Prisma) | `DATABASE_URL` |
| Realtime | `GET /api/events` (SSE) | 45s stream per connection, client auto-reconnects |
| Playlist auto-sync | Vercel Cron → `/api/cron/playlist-sync` | schedule in `vercel.json` |

The whole admin store (playlists, channels, live/upcoming events, banners,
settings, viewer accounts, sessions, push subscriptions) lives in Postgres. The
server keeps an in-memory cache per lambda instance and writes a diffed snapshot
in one transaction, bumping `store_meta.revision`. Every connected browser gets
the new revision over SSE and refetches.

## One-time setup

1. **Create the Neon project** (https://console.neon.tech) and copy the
   **pooled** connection string (Host starts with `ep-…-pooler`).
   Append `?sslmode=require&pgbouncer=true&connection_limit=1`.

2. **Local `.env`**:

   ```
   DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1"
   ADMIN_USER="admin"
   ADMIN_PASS="change-me"
   ```

3. **Apply the schema** (creates the tables):

   ```bash
   bun run db:migrate     # prisma migrate deploy
   ```

4. **Seed**: the first boot against an empty database imports
   `server/data/store.json` (playlists, channels, accounts) automatically, in
   one transaction. On a fresh deploy there is no such file, so the site starts
   with built-in fixtures; import a playlist from `/admin` to populate it.

## Vercel project settings

Environment variables (Production + Preview):

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string |
| `ADMIN_USER` / `ADMIN_PASS` | admin console credentials |
| `CRON_SECRET` | random string; Vercel sends it as `Authorization: Bearer …` to the cron route |

Build settings come from `vercel.json`: build command
`prisma generate && vite build`, output `dist/`, framework `vite`.

`server/data/store.json` is git-ignored and read-only in serverless, so **the
API refuses to start on Vercel without `DATABASE_URL`** rather than silently
dropping writes.

## Cron

`vercel.json` schedules `/api/cron/playlist-sync` every 5 minutes. Vercel Hobby
only allows daily crons — loosen the schedule to `0 0 * * *` on Hobby, or move
the project to Pro for 5-minute sync. The route is idempotent and safe to call
manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/playlist-sync
```

## AdSense

Ads are managed from **Admin → Settings → Monetization** and propagate live
over SSE — no redeploy needed to enable or change a unit.

1. Set the publisher id in the admin panel (`ca-pub-…`) or as
   `VITE_ADSENSE_CLIENT` in Vercel (Production + Preview).
2. Create one ad unit per placement in AdSense and paste its numeric id into
   the matching row; toggle the row on.
3. Turn on the master switch. AdSense's `adsbygoogle.js` is only requested after
   that switch and after the viewer accepts the consent prompt (when
   `Require consent` is on).
4. `GET /ads.txt` is generated from the publisher id (admin value first, then
   `VITE_ADSENSE_CLIENT`) by `server/api.ts`; `vercel.json` rewrites it before
   the SPA fallback. Never commit a static `public/ads.txt`, or the CDN will
   shadow the dynamic route.
5. Use `VITE_ADSENSE_TEST=1` on preview deployments; test clicks never reach the
   real account.

Placements, sizes and the per-view cap are documented in
[docs/ADSENSE_PLAN.md](docs/ADSENSE_PLAN.md). Ads never render on the player,
PiP, admin console or auth screens.

## Realtime on serverless, honestly

* One lambda instance only sees its own writes; it detects writes from other
  instances by polling `store_meta.revision` (10s on Vercel, 4s locally) and
  pulling the newer snapshot.
* A stream lives 45s, then closes; the browser reconnects with `retry: 3000`
  and immediately gets a `ready` frame carrying the current revision, so a
  refresh is never missed for longer than the reconnect window.
* For very high viewer counts, prefer the client polling fallback over
  per-connection revision polling.

## Known limits

* `/api/iptv/stream` proxies upstream video through a function: capped by
  `maxDuration` (60s on Hobby) and by bandwidth. For heavy traffic, put the
  proxy on a long-running host (Railway/Fly/VM) and point the site at it.
* Push notifications need `web-push` keys in the store; they are persisted in
  Postgres and survive redeploys.
