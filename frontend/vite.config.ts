/// <reference types="vitest" />
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Writes sitemap.xml and robots.txt with the real site URL at build time. */
function seoFiles(siteUrl: string): Plugin {
  const publicRoutes = ['/', '/login', '/register', '/about', '/privacy', '/terms'];
  return {
    name: 'gurukul-seo-files',
    apply: 'build',
    closeBundle() {
      const out = path.resolve(__dirname, 'dist');
      const base = siteUrl.replace(/\/$/, '');
      const today = new Date().toISOString().slice(0, 10);
      const urls = publicRoutes.map((r) => `  <url><loc>${base}${r}</loc><lastmod>${today}</lastmod></url>`).join('\n');
      fs.writeFileSync(path.join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
      // Inject the hashed build files into the service worker so every route works offline after the first visit
      const assets = fs.readdirSync(path.join(out, 'assets')).map((f) => `/assets/${f}`);
      const swPath = path.join(out, 'sw.js');
      const sw = fs.readFileSync(swPath, 'utf8').replace('const PRECACHE_ASSETS = [];', `const PRECACHE_ASSETS = ${JSON.stringify(assets)};`);
      fs.writeFileSync(swPath, sw.replace("const VERSION = 'v1';", `const VERSION = '${Date.now().toString(36)}';`));
      fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /guardian\nDisallow: /onboarding\n\nSitemap: ${base}/sitemap.xml\n`);
    },
  };
}

/** The API always runs on Render; there is no local backend. */
const DEFAULT_API_ORIGIN = 'https://gurukul-ai-o0nq.onrender.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // Local dev and preview forward /api to the Render API, like the Vercel rewrite in production,
  // so the login cookie is first-party on localhost as well.
  let apiOrigin = DEFAULT_API_ORIGIN;
  try {
    const u = new URL(env.VITE_API_URL || '');
    if (!/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) apiOrigin = u.origin;
  } catch {
    /* not set or relative: keep the default */
  }
  const apiProxy = {
    '/api': {
      target: apiOrigin,
      changeOrigin: true,
      secure: true,
      // Same-origin call from the browser's point of view: drop Origin so the API's CORS check
      // (which lists only the production site) does not apply to the dev proxy.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      configure: (proxy: any) => {
        proxy.on('proxyReq', (req: { removeHeader: (name: string) => void }) => req.removeHeader('origin'));
        // localhost is plain http: a "Secure; SameSite=None" login cookie is dropped by some
        // browsers (e.g. Safari), which logs the student out on every reload. Over this dev proxy
        // the cookie is first-party, so serve it as a normal Lax cookie without Secure.
        proxy.on('proxyRes', (res: { headers: Record<string, string | string[] | undefined> }) => {
          const cookies = res.headers['set-cookie'];
          if (Array.isArray(cookies)) {
            res.headers['set-cookie'] = cookies.map((c) => c.replace(/;\s*Secure/gi, '').replace(/SameSite=None/gi, 'SameSite=Lax'));
          }
        });
      },
    },
  };
  return {
    plugins: [react(), seoFiles(env.VITE_SITE_URL || 'http://localhost:5173')],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { port: 5173, strictPort: true, proxy: apiProxy },
    preview: { port: 4173, proxy: apiProxy },
    build: {
      target: 'es2019',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
          },
        },
      },
    },
    test: { include: ['src/**/*.test.ts'] },
  };
});
