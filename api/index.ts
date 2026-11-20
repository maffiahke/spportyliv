/**
 * Vercel serverless entry point.
 *
 * The Vite dev/preview servers mount `handleApiRequest` as middleware; on
 * Vercel the same handler runs behind this single function, with static assets
 * served from the CDN and `vercel.json` rewriting every /api/* path here.
 */
import express from 'express';
import { handleApiRequest, startAutoSync } from '../server/api';
import { isServerlessRuntime } from '../server/store';

const app = express();

app.use((req, res) => {
  void (async () => {
    try {
      const handled = await handleApiRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (err) {
      console.error('[api] request failed:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: (err as Error).message }));
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  })();
});

// Streaming (IPTV proxy, SSE) needs headroom; Vercel clamps this to the plan's
// maximum (60s on Hobby, more on Pro).
export const maxDuration = 60;

// Local `vercel dev` behaves like a single long-lived process, so keep the
// scheduler there. On Vercel itself the `/api/cron/playlist-sync` route runs
// the loop instead.
if (!isServerlessRuntime()) startAutoSync();

export default app;
