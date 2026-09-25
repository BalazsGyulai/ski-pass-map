const BASE = "/ski-pass-map";
const CACHE = "ski-pass-map-__BUILD_ID__";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (!client.url.includes(BASE)) continue;
        client.postMessage({ type: "sw-reload", cache: CACHE });
        if (typeof client.navigate === "function") client.navigate(client.url).catch(() => {});
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/sw.js")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    event.respondWith(networkFirstDocument(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && !response.redirected) {
    const cache = await caches.open(CACHE);
    await cache.put(request.url, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: "reload" });
    if (response.ok && !response.redirected) await cache.put(request.url, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function networkFirstDocument(request) {
  try {
    const response = await fetch(request, { cache: "reload" });
    if (response.ok && isHtml(response) && !response.redirected) {
      const copy = response.clone();
      const html = await response.clone().text();
      caches
        .open(CACHE)
        .then(async (cache) => {
          await cache.put(request.url, copy);
          await cacheLinkedAssets(cache, html);
        })
        .catch(() => {});
    }
    return response;
  } catch {
    const cached = await usableDocument(await caches.match(request));
    if (cached) return cached;
    const fallback = await usableDocument(await caches.match(`${BASE}/`));
    if (fallback) return fallback;
    return offlineDocument();
  }
}

async function cacheLinkedAssets(cache, html) {
  await Promise.all(
    staticUrls(html).map(async (path) => {
      const absolute = new URL(path, self.location.origin).href;
      if (await cache.match(absolute)) return;
      try {
        const response = await fetch(absolute, { cache: "reload" });
        if (response.ok && !response.redirected) await cache.put(absolute, response);
      } catch {
        // The document stays usable online; offline falls back only when every asset is cached.
      }
    }),
  );
}

async function usableDocument(response) {
  if (!response) return null;
  if (!isHtml(response)) return response;
  const html = await response.clone().text();
  const ready = await Promise.all(staticUrls(html).map((path) => caches.match(new URL(path, self.location.origin).href)));
  if (ready.some((hit) => !hit)) return null;
  return response;
}

function staticUrls(html) {
  return [...new Set([...html.matchAll(/\/ski-pass-map\/_next\/static\/[^"'\\\s)]+/g)].map((match) => match[0]))];
}

function isHtml(response) {
  return (response.headers.get("content-type") || "").includes("text/html");
}

function offlineDocument() {
  return new Response("<!doctype html><title>Ski pass map</title><p>You are offline, and this version is not saved on the device.</p>", {
    status: 503,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
