// Service Worker for Layanan Pensiunan Enterprise PWA
const CACHE_NAME = "lp-enterprise-pwa-v2.5";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./assets/css/styles.css",
  "./assets/js/config/brand-assets.js",
  "./assets/js/config/default-parameters.js",
  "./assets/js/core/rbac-guard.js",
  "./assets/js/core/storage-service.js",
  "./assets/js/engines/ams2-engine.js",
  "./assets/js/engines/bsi-simas-engine.js",
  "./assets/js/engines/partner-bank-engine.js",
  "./assets/js/core/pdf-generator.js",
  "./assets/js/app.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
