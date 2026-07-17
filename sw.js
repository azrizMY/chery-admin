// sw.js - Service Worker for PWA
const CACHE_NAME = "chery-calc-v150";
const VEHICLE_DATA_ORIGIN = "https://chery-car-data.data-quotation.workers.dev";
const APP_SHELL_URLS = [
  "/style.css",
  "/script.js",
  "/manifest.json",
];
const APP_SHELL_PATHS = new Set(APP_SHELL_URLS.map((url) => new URL(url, self.location.origin).pathname));

function freshRequest(request) {
  return new Request(request, {
    cache: "reload",
    redirect: "error",
  });
}

function noStoreJson(body, status = 503) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function fetchAndCacheAppShell(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(freshRequest(request));

    if (response.ok && !response.redirected) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request)
      || await cache.match(new URL(request.url).pathname);

    if (cached) return cached;
    throw error;
  }
}

async function fetchVehicleData(request) {
  try {
    return await fetch(new Request(request, { cache: "no-store" }));
  } catch (error) {
    return noStoreJson({
      error: "live_vehicle_data_unavailable",
      message: "Live Chery vehicle data is unavailable. Please try again online.",
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(
        APP_SHELL_URLS.map((url) => new Request(new URL(url, self.location.origin), {
          cache: "reload",
          redirect: "error",
        }))
      ))
  );
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Let the browser handle document navigations and any server redirects.
  // Safari rejects navigation responses whose redirect chain came through a service worker.
  if (request.mode === "navigate") return;

  const url = new URL(request.url);

  if (url.origin === VEHICLE_DATA_ORIGIN) {
    event.respondWith(fetchVehicleData(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (APP_SHELL_PATHS.has(url.pathname)) {
    event.respondWith(fetchAndCacheAppShell(request));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cache) => {
        if (cache !== CACHE_NAME) {
          return caches.delete(cache);
        }
        return undefined;
      })
    ))
  );
  self.clients.claim();
});
