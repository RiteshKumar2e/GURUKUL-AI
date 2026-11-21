/* GURUKUL AI service worker — hand-written, no build plugin.
 * - App shell: network-first for navigations, falling back to the cached shell offline.
 * - Hashed build assets (/assets/*): cache-first.
 * - Public curriculum API (curriculum, chapters, topics): network-first with cache fallback.
 * - Background sync: wakes open tabs so they push the offline queue.
 */
const VERSION = 'v1';
const SHELL = `gk-shell-${VERSION}`;
const ASSETS = `gk-assets-${VERSION}`;
const API = `gk-api-${VERSION}`;
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png'];
// Filled in at build time with the hashed JS/CSS/font files (see vite.config.ts)
const PRECACHE_ASSETS = [];
const CACHEABLE_API = /\/api\/(curriculum|chapters|topics)(\/|$|\?)/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)), caches.open(ASSETS).then((c) => c.addAll(PRECACHE_ASSETS))]).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Only public curriculum content is cached; personal data endpoints are never cached here.
  if (CACHEABLE_API.test(url.pathname) && !request.headers.get('Authorization')) {
    event.respondWith(networkFirst(request, API));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'gurukul-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => clients.forEach((c) => c.postMessage({ type: 'SYNC_NOW' }))),
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
