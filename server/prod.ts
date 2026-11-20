/**
 * SportyLive production server.
 * Serves the built frontend (dist/) plus the IPTV API:
 *   - /api/data                     app content (channels, events, banners)
 *   - /api/iptv/stream              header-aware streaming proxy
 *   - /api/admin/playlists|channels|events|banners   admin management
 *
 * Run:  bun run build && bun run start
 */
import path from 'path';
import fs from 'fs';
import express from 'express';
import { handleApiRequest, startAutoSync } from './api';
import { prisma } from './db';
import { ensureStoreReady, flushStore, storeBackend } from './store';

const app = express();
const distDir = path.resolve(process.cwd(), 'dist');
const port = Number(process.env.PORT || 3000);

app.use(async (req, res, next) => {
  try {
    const handled = await handleApiRequest(req, res);
    if (!handled) next();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: 'index.html' }));
  // Admin SPA at clean URLs
  const adminHtml = path.join(distDir, 'admin.html');
  app.get(['/admin', '/admin/login'], (req, res) => {
    if (fs.existsSync(adminHtml)) res.sendFile(adminHtml);
    else res.status(503).send('Admin bundle not built. Run `bun run build`.');
  });
  // SPA fallback
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .send('dist/ not built yet. Run `bun run build` first, then `bun run start`.');
  });
}

// Load the Neon store before accepting traffic so the first request is fast.
await ensureStoreReady();

const server = app.listen(port, '0.0.0.0', () => {
  startAutoSync();
  console.log(
    `SportyLive server listening on http://localhost:${port} (store: ${storeBackend()})`
  );
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`[server] ${signal} received — flushing pending store writes`);
  await flushStore();
  await prisma?.$disconnect();
  server.close(() => process.exit(0));
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
