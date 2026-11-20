<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5423e5ef-3b3b-4016-8fc5-25f6b0106dea

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Data, realtime & deployment

The admin store is persisted in Neon Postgres through Prisma, and every commit
is pushed to browsers over `GET /api/events` (SSE). Without `DATABASE_URL` the
server falls back to `server/data/store.json` for local work.

Deploying to Vercel: see [DEPLOY.md](DEPLOY.md).
