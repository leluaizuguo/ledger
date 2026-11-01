/// <reference types="vite-plugin-pwa/client" />

// This file is processed by vite-plugin-pwa in injectManifest mode.
// The self.__WB_MANIFEST placeholder is replaced with the precache manifest at build time.

const CACHE_NAME = 'ledger-v1';

// Precached by workbox during build
const manifest = self.__WB_MANIFEST || [];

self.addEventListener('install', (event) => {
  console.log('[SW] install');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urls = manifest.map((entry) => (typeof entry === 'string' ? entry : entry.url));
      console.log('[SW] caching:', urls);
      return cache.addAll(urls);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle requests within our scope
  if (!url.pathname.startsWith('/ledger/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // For navigation requests, serve index.html from cache
      if (event.request.mode === 'navigate') {
        return caches.match('/ledger/').then((r) => r || caches.match('/ledger/index.html'));
      }

      // Try network, cache the result for next time
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
