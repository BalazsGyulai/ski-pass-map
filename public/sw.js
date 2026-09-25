const BASE = "/ski-pass-map";
const CACHE = "ski-pass-map-v1";

const PRECACHE = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/compare/`,
  `${BASE}/compare/index.html`,
  `${BASE}/plan/`,
  `${BASE}/plan/index.html`,
  `${BASE}/about/`,
  `${BASE}/about/index.html`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`,
  `${BASE}/apple-touch-icon.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await caches.match(`${BASE}/index.html`);
      if (fallback) return fallback;
    }
    throw error;
  }
}
