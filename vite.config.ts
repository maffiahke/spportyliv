import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {handleApiRequest, startAutoSync} from './server/api';

// IPTV backend middleware: playlist API, admin CRUD, and the header-aware
// stream proxy all run inside the Vite dev/preview server.
function iptvApiPlugin(): Plugin {
  const middleware = async (req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => {
    try {
      const url = req.url ?? '';
      // Serve the standalone admin SPA at clean URLs in dev — rewrite to the
      // real admin.html so Vite's HTML transform (React preamble, HMR) applies.
      if (url === '/admin' || url.startsWith('/admin/login') || url.startsWith('/admin?')) {
        req.url = '/admin.html' + (url.includes('?') ? url.slice(url.indexOf('?')) : '');
        next();
        return;
      }
      const handled = await handleApiRequest(req, res);
      if (!handled) next();
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({error: (err as Error).message}));
    }
  };
  return {
    name: 'sportylive-iptv-api',
    configureServer(server) {
      startAutoSync();
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      startAutoSync();
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      iptvApiPlugin(),
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
