const CACHE_NAME = "logistiko-static-v1";
const STATIC_ASSETS = ["/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Cache-first μόνο για στατικά αρχεία (εικόνες, Next.js build assets).
// Σελίδες και API παραμένουν πάντα live από το δίκτυο — ποτέ stale δεδομένα επιχείρησης.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isStaticAsset = url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname);

  if (isStaticAsset) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
