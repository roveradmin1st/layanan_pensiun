// ============================================================================
// LAYANAN PENSIUNAN — PRODUCTION PWA SERVICE WORKER
// Aturan keamanan data finansial:
// 1. Seluruh endpoint /api/* 100% NetworkOnly (tidak pernah masuk cache).
// 2. Dokumen HTML menggunakan Network-First agar update rumus/UI langsung aktif.
// 3. Aset statis ber-hash Vite (/assets/*) & ikon brand di-cache dengan versi.
// 4. Menyertakan header bypass interupsi tunnel (ngrok-skip-browser-warning)
//    agar manifest.webmanifest & icon PWA selalu valid untuk prompt instalasi.
// ============================================================================

const CACHE_NAME = "lp-pwa-shell-v2.5.7";
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/brand/pwa-192x192.png",
  "/brand/pwa-512x512.png",
  "/brand/pwa-maskable-512x512.png",
  "/brand/logo-ams.png",
  "/brand/logo-mestika.png"
];

function fetchWithTunnelBypass(urlOrReq) {
  const targetUrl = typeof urlOrReq === "string" ? urlOrReq : urlOrReq.url;
  return fetch(targetUrl, {
    method: "GET",
    credentials: "include",
    headers: {
      "ngrok-skip-browser-warning": "true"
    }
  });
}

function isValidResponse(response) {
  if (!response || !response.ok) return false;
  if (response.headers && response.headers.get("ngrok-error-code")) return false;
  return true;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetchWithTunnelBypass(url).then((res) => {
            if (isValidResponse(res)) {
              return cache.put(url, res);
            }
          })
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. DILARANG meng-cache request API (rumus, parameter, auth, dokumen)
  if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
    return;
  }

  // 2. Navigasi halaman SPA: Network-First agar rilis kode baru selalu langsung dimuat
  if (request.mode === "navigate") {
    event.respondWith(
      fetchWithTunnelBypass(request)
        .then((response) => {
          if (isValidResponse(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match("/index.html")) || (await cache.match("/"));
        })
    );
    return;
  }

  // 3. Bundle Vite ber-hash (/assets/*): Cache-First (aman karena nama file berubah tiap build)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetchWithTunnelBypass(request).then((response) => {
          if (isValidResponse(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Ikon & manifest: Stale-While-Revalidate dengan header bypass ngrok
  if (url.pathname.startsWith("/brand/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(url.pathname).then((cached) => {
        const networkFetch = fetchWithTunnelBypass(request)
          .then((response) => {
            if (isValidResponse(response)) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
