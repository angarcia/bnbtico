// Estrategias de caché en tiempo de ejecución del service worker, con la Cache API y fetch inyectados (probadas en Node).

export interface CacheLike {
  match(request: Request | string): Promise<Response | undefined>;
  put(request: Request | string, response: Response): Promise<void>;
  delete(request: Request | string): Promise<boolean>;
  keys(): Promise<readonly Request[]>;
}

export interface CachesLike {
  open(name: string): Promise<CacheLike>;
  delete(name: string): Promise<boolean>;
}

export interface RuntimeDeps {
  caches: CachesLike;
  fetch(request: Request): Promise<Response>;
  now(): number;
  /** Trabajo que sigue después de responder (guardar, renovar): el SW lo pasa a event.waitUntil. */
  waitUntil(work: Promise<unknown>): void;
}

const STAMP = "x-sw-cached-at";

/** Copia con la hora de guardado (las respuestas opacas no se pueden reenvolver: van tal cual y no caducan). */
function stamped(res: Response, now: number): Response {
  if (res.type === "opaque") return res;
  const headers = new Headers(res.headers);
  headers.set(STAMP, String(now));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

const cacheable = (res: Response) => res.ok || res.type === "opaque";

/** Guarda y recorta a maxEntries (la Cache API devuelve las claves en orden de inserción). Ante cuota llena, vacía esa caché. */
async function store(deps: RuntimeDeps, cacheName: string, request: Request, res: Response, maxEntries: number) {
  try {
    const cache = await deps.caches.open(cacheName);
    await cache.put(request, stamped(res, deps.now()));
    const keys = await cache.keys();
    for (const old of keys.slice(0, Math.max(0, keys.length - maxEntries))) await cache.delete(old);
  } catch {
    await deps.caches.delete(cacheName);
  }
}

function keep(deps: RuntimeDeps, cacheName: string, request: Request, res: Response, maxEntries: number): Response {
  if (cacheable(res)) deps.waitUntil(store(deps, cacheName, request, res.clone(), maxEntries));
  return res;
}

export async function cacheFirst(deps: RuntimeDeps, request: Request, opts: { cacheName: string; maxEntries: number; maxAgeMs: number }): Promise<Response> {
  const cache = await deps.caches.open(opts.cacheName);
  const hit = await cache.match(request);
  if (hit) {
    const at = Number(hit.headers.get(STAMP) ?? NaN);
    if (Number.isNaN(at) || deps.now() - at < opts.maxAgeMs) return hit;
    await cache.delete(request);
  }
  return keep(deps, opts.cacheName, request, await deps.fetch(request), opts.maxEntries);
}

export async function staleWhileRevalidate(deps: RuntimeDeps, request: Request, opts: { cacheName: string; maxEntries: number }): Promise<Response> {
  const hit = await (await deps.caches.open(opts.cacheName)).match(request);
  const fresh = deps.fetch(request).then((res) => keep(deps, opts.cacheName, request, res, opts.maxEntries));
  if (!hit) return fresh;
  deps.waitUntil(fresh.catch(() => undefined));
  return hit;
}

/**
 * Red primero. Si la red tarda más de timeoutMs y hay copia guardada, responde con la copia (la red sigue y la renueva);
 * si la red falla, la copia o el respaldo; sin copia ni respaldo, el error de red.
 */
export async function networkFirst(
  deps: RuntimeDeps,
  request: Request,
  opts: { cacheName: string; maxEntries: number; timeoutMs: number; fallback(): Promise<Response | undefined> },
): Promise<Response> {
  const cached = () => deps.caches.open(opts.cacheName).then((c) => c.match(request));
  const network = deps.fetch(request).then((res) => keep(deps, opts.cacheName, request, res, opts.maxEntries));
  deps.waitUntil(network.catch(() => undefined));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<Response | undefined>((resolve) => {
    timer = setTimeout(() => void cached().then(resolve), opts.timeoutMs);
  });
  try {
    const first = await Promise.race([network, slow]);
    return first ?? (await network);
  } catch (error) {
    const copy = (await cached()) ?? (await opts.fallback());
    if (copy) return copy;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
