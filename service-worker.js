// Robust service worker: caches local assets only, tolerant to fetch failures.
// Uses registration scope as BASE so it works on GitHub Pages (project pages).
const CACHE_NAME = 'dualpay-cache-v1';

self.addEventListener('install', event => {
  const BASE = self.registration.scope || '/';
  const ASSETS = [
    BASE,
    BASE + 'index.html',
    BASE + 'manifest.json',
    BASE + 'icon-192.svg',
    BASE + 'icon-512.svg'
  ];

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // try to cache each asset, but don't fail install if one fails
    for (const asset of ASSETS) {
      try {
        const resp = await fetch(asset);
        if (resp && resp.ok) {
          await cache.put(asset, resp.clone());
        } else {
          // not ok, skip
          console.warn('Could not cache (not ok):', asset, resp && resp.status);
        }
      } catch (err) {
        console.warn('Could not cache (error):', asset, err);
      }
    }
    // skipWaiting to activate quickly
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // delete old caches if any
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  // Cache-first for same-origin GET requests
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const networkResponse = await fetch(event.request);
      // optionally cache the new GET request (only if OK)
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (err) {
      // fallback: try to return cached index.html for navigation requests
      const accept = event.request.headers.get('accept') || '';
      if (accept.includes('text/html')) {
        const BASE = self.registration.scope || '/';
        const fallback = await caches.match(BASE + 'index.html');
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
