const CACHE_NAME = "gizmocraft-shell-v5";
const SHELL_ROUTES = [
  "/",
  "/dashboard",
  "/signing",
  "/brand/gizmocraft-floating-world-logo.png",
  "/gizmocraft-logo-icon.png",
  "/icons/gizmocraft-logo-192.png",
  "/icons/gizmocraft-logo-512.png",
  "/manifest.webmanifest",
];

const CACHE_FIRST_PATH_PREFIXES = ["/brand/", "/icons/"];
const CACHE_FIRST_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"];

function shouldUseCacheFirst(url) {
  return (
    CACHE_FIRST_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    CACHE_FIRST_EXTENSIONS.some((extension) => url.pathname.endsWith(extension))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ROUTES)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  if (shouldUseCacheFirst(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/signing"))),
  );
});
