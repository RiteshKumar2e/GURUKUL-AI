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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), seoFiles(env.VITE_SITE_URL || 'http://localhost:5173')],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173 },
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
