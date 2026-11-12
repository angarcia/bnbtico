/// <reference lib="webworker" />
// Service worker de 3bstays: se compila aparte como /sw.js (vite.config.ts) con la lista de precache del build.
import { SHELL_URL, strategyFor } from "./routes";
import { cacheFirst, networkFirst, staleWhileRevalidate, type RuntimeDeps } from "./runtime";

declare const self: ServiceWorkerGlobalScope;
declare const __PRECACHE__: string[];
declare const __BUILD_ID__: string;

const PRECACHE = `precache-${__BUILD_ID__}`;
const PAGES = "pages";
const precached = new Set(__PRECACHE__);

self.addEventListener("install", (event) => {
  // Sin skipWaiting: la versión nueva espera hasta que la persona toque «Actualizar».
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(__PRECACHE__.map((url) => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Fuera los precaches viejos y las fichas guardadas: su HTML apunta a JS de otro despliegue.
      for (const name of await caches.keys()) if ((name.startsWith("precache-") && name !== PRECACHE) || name === PAGES) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") void self.skipWaiting();
});

/** Imágenes de otro origen: se piden con CORS (Storage y OSM lo permiten) para no guardar respuestas opacas, que pesan mucho en la cuota. */
const fetchCors = (request: Request) => fetch(request.url, { mode: "cors", credentials: "omit" }).catch(() => fetch(request));

// ignoreVary: el precache se guardó sin cabecera Origin y los módulos la mandan (Vary: Origin no debe impedir el acierto).
const fromPrecache = async (request: Request) => (await caches.match(request, { ignoreSearch: true, ignoreVary: true })) ?? fetch(request);
const shell = () => caches.match(SHELL_URL, { cacheName: PRECACHE, ignoreVary: true });

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategy = strategyFor(request, self.location.origin, precached);
  if (strategy === "network") return;
  const deps = (fetcher: (r: Request) => Promise<Response>): RuntimeDeps => ({
    caches,
    fetch: fetcher,
    now: Date.now,
    waitUntil: (work) => event.waitUntil(work),
  });
  switch (strategy) {
    case "precache":
      return event.respondWith(fromPrecache(request));
    case "shell":
      return event.respondWith(shell().then((res) => res ?? fetch(request)));
    case "page":
      return event.respondWith(networkFirst(deps((r) => fetch(r)), request, { cacheName: PAGES, maxEntries: 50, timeoutMs: 3000, fallback: shell }));
    case "photo":
      return event.respondWith(cacheFirst(deps(fetchCors), request, { cacheName: "photos", maxEntries: 400, maxAgeMs: 30 * 24 * 60 * 60_000 }));
    case "tile":
      return event.respondWith(staleWhileRevalidate(deps(fetchCors), request, { cacheName: "tiles", maxEntries: 300 }));
  }
});
