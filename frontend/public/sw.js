// ============================================================================
// LAYANAN PENSIUNAN — PRODUCTION PWA SERVICE WORKER
// Aturan keamanan data finansial:
// 1. Seluruh endpoint /api/* 100% NetworkOnly (tidak pernah masuk cache).
// 2. Dokumen HTML menggunakan Network-First agar update rumus/UI langsung aktif.
// 3. Aset statis ber-hash Vite (/assets/*) & ikon brand di-cache dengan validasi
//    Content-Type ketat (anti cache-poisoning SPA fallback text/html).
// 4. Menyertakan header bypass interupsi tunnel (ngrok-skip-browser-warning)
//    agar manifest.webmanifest & icon PWA selalu valid untuk prompt instalasi.
// ============================================================================

const CACHE_NAME = "lp-pwa-shell-v2.6.6";
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
  if (response.type && response.type !== "basic" && response.type !== "cors") return false;
  if (response.headers && response.headers.get("ngrok-error-code")) return false;
  return true;
}

function isHtmlContentType(contentType) {
  const ct = String(contentType || "").toLowerCase();
  return ct.includes("text/html") || ct.includes("application/xhtml");
}

function isValidHtmlResponse(response) {
  if (!isValidResponse(response)) return false;
  const ct = response.headers ? response.headers.get("content-type") || "" : "";
  return isHtmlContentType(ct);
}

function isValidAssetResponse(response, pathname) {
  if (!isValidResponse(response)) return false;
  const ct = String(response.headers?.get("content-type") || "").toLowerCase();
  // Jangan pernah menyimpan fallback SPA HTML (text/html) atau respons tanpa Content-Type di bawah /assets/*
  if (!ct || isHtmlContentType(ct)) return false;
  const lowerPath = String(pathname || "").toLowerCase();
  if (lowerPath.endsWith(".js") || lowerPath.endsWith(".mjs")) {
    return ct.includes("javascript") || ct.includes("ecmascript");
  }
  if (lowerPath.endsWith(".css")) {
    return ct.includes("text/css");
  }
  if (lowerPath.endsWith(".json") || lowerPath.endsWith(".webmanifest")) {
    return ct.includes("json") || ct.includes("manifest");
  }
  if (/\.(png|jpe?g|webp|gif|ico|svg)$/.test(lowerPath)) {
    return ct.startsWith("image/");
  }
  if (/\.(woff2?|ttf|otf|eot)$/.test(lowerPath)) {
    return ct.startsWith("font/") || ct.includes("octet-stream") || ct.includes("fontobject");
  }
  return true;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetchWithTunnelBypass(url).then((res) => {
            const isDoc = url === "/" || url === "/index.html";
            if (isDoc ? isValidHtmlResponse(res) : isValidAssetResponse(res, url)) {
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
          if (isValidHtmlResponse(response)) {
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

  // 3. Bundle Vite ber-hash (/assets/*): Cache-First dengan validasi Content-Type ketat
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached && isValidAssetResponse(cached, url.pathname)) return cached;
        return fetchWithTunnelBypass(request).then((response) => {
          if (isValidAssetResponse(response, url.pathname)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Ikon & manifest: Stale-While-Revalidate dengan validasi Content-Type & bypass ngrok
  if (url.pathname.startsWith("/brand/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(url.pathname).then((cached) => {
        const networkFetch = fetchWithTunnelBypass(request)
          .then((response) => {
            if (isValidAssetResponse(response, url.pathname)) {
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
