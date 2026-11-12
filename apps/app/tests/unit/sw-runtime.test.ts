import { describe, expect, it, vi } from "vitest";
import { cacheFirst, networkFirst, staleWhileRevalidate, type CachesLike, type RuntimeDeps } from "../../src/sw/runtime";

const DAY = 24 * 60 * 60_000;

/** CacheStorage en memoria con el orden de inserción de la Cache API. */
function memoryCaches() {
  const stores = new Map<string, Map<string, Response>>();
  let quotaFull = false;
  const caches: CachesLike = {
    async open(name) {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        async match(r) {
          return store.get(typeof r === "string" ? r : r.url)?.clone();
        },
        async put(r, res) {
          if (quotaFull) throw new DOMException("lleno", "QuotaExceededError");
          const key = typeof r === "string" ? r : r.url;
          store.delete(key);
          store.set(key, res);
        },
        async delete(r) {
          return store.delete(typeof r === "string" ? r : r.url);
        },
        async keys() {
          return [...store.keys()].map((u) => new Request(u));
        },
      };
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  return { caches, stores, fill: (v: boolean) => (quotaFull = v), size: (name: string) => stores.get(name)?.size ?? 0 };
}

function setup(fetchImpl: (r: Request) => Promise<Response> = async (r) => new Response(`red:${r.url}`)) {
  const mem = memoryCaches();
  let now = 1_000_000;
  const pending: Promise<unknown>[] = [];
  const fetchSpy = vi.fn(fetchImpl);
  const deps: RuntimeDeps = { caches: mem.caches, fetch: fetchSpy, now: () => now, waitUntil: (p) => void pending.push(p) };
  return { deps, mem, fetchSpy, tick: (ms: number) => (now += ms), settle: () => Promise.all(pending.splice(0)) };
}

const photo = (n: number) => new Request(`https://x.supabase.co/storage/v1/object/public/listings/c/${n}/480.jpg`);
const PHOTOS = { cacheName: "photos", maxEntries: 3, maxAgeMs: 30 * DAY };

describe("fotos: caché primero", () => {
  it("la segunda vez sale de la caché sin red; caduca a los 30 días", async () => {
    const t = setup();
    expect(await (await cacheFirst(t.deps, photo(1), PHOTOS)).text()).toContain("/1/480.jpg");
    await t.settle();
    await cacheFirst(t.deps, photo(1), PHOTOS);
    expect(t.fetchSpy).toHaveBeenCalledTimes(1);
    t.tick(31 * DAY);
    await cacheFirst(t.deps, photo(1), PHOTOS);
    expect(t.fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("guarda como mucho maxEntries y suelta las más antiguas", async () => {
    const t = setup();
    for (const n of [1, 2, 3, 4, 5]) {
      await cacheFirst(t.deps, photo(n), PHOTOS);
      await t.settle();
    }
    expect(t.mem.size("photos")).toBe(3);
    await cacheFirst(t.deps, photo(5), PHOTOS);
    await cacheFirst(t.deps, photo(1), PHOTOS);
    expect(t.fetchSpy).toHaveBeenCalledTimes(6);
  });

  it("si se llena la cuota, vacía la caché de fotos y la foto se sirve igual", async () => {
    const t = setup();
    await cacheFirst(t.deps, photo(1), PHOTOS);
    await t.settle();
    t.mem.fill(true);
    const res = await cacheFirst(t.deps, photo(2), PHOTOS);
    await t.settle();
    expect(res.ok).toBe(true);
    expect(t.mem.stores.has("photos")).toBe(false);
  });

  it("no guarda errores del servidor", async () => {
    const t = setup(async () => new Response("no", { status: 404 }));
    expect((await cacheFirst(t.deps, photo(1), PHOTOS)).status).toBe(404);
    await t.settle();
    expect(t.mem.size("photos")).toBe(0);
  });
});

describe("teselas: obsoleto mientras se revalida", () => {
  const TILES = { cacheName: "tiles", maxEntries: 10 };
  const tile = new Request("https://tile.openstreetmap.org/15/1/2.png");

  it("responde con la guardada y la renueva por detrás", async () => {
    let version = 1;
    const t = setup(async () => new Response(`v${version}`));
    expect(await (await staleWhileRevalidate(t.deps, tile, TILES)).text()).toBe("v1");
    await t.settle();
    version = 2;
    expect(await (await staleWhileRevalidate(t.deps, tile, TILES)).text()).toBe("v1");
    await t.settle();
    expect(await (await staleWhileRevalidate(t.deps, tile, TILES)).text()).toBe("v2");
  });

  it("sin red responde con la guardada sin romper la renovación", async () => {
    let online = true;
    const t = setup(async () => (online ? new Response("ok") : Promise.reject(new TypeError("Failed to fetch"))));
    await staleWhileRevalidate(t.deps, tile, TILES);
    await t.settle();
    online = false;
    expect(await (await staleWhileRevalidate(t.deps, tile, TILES)).text()).toBe("ok");
    await t.settle();
  });
});

describe("ficha: red primero con 3 s de espera", () => {
  const page = new Request("https://pruebas.3bstays.com/casa/CT-1234");
  const PAGES = { cacheName: "pages", maxEntries: 5, timeoutMs: 3000 };

  it("con red responde la red y la guarda; sin red, la guardada; sin nada, el respaldo", async () => {
    let online = true;
    const t = setup(async () => (online ? new Response("fresca") : Promise.reject(new TypeError("Failed to fetch"))));
    expect(await (await networkFirst(t.deps, page, { ...PAGES, fallback: async () => undefined })).text()).toBe("fresca");
    await t.settle();
    online = false;
    expect(await (await networkFirst(t.deps, page, { ...PAGES, fallback: async () => new Response("shell") })).text()).toBe("fresca");
    const otra = new Request("https://pruebas.3bstays.com/casa/CT-9999");
    expect(await (await networkFirst(t.deps, otra, { ...PAGES, fallback: async () => new Response("shell") })).text()).toBe("shell");
    await expect(networkFirst(t.deps, otra, { ...PAGES, fallback: async () => undefined })).rejects.toThrow();
  });

  it("si la red tarda más de 3 s y hay copia, sirve la copia; si no hay copia, espera a la red", async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      const t = setup(() => new Promise<Response>((resolve) => (release = () => resolve(new Response("lenta")))));
      const cache = await t.mem.caches.open("pages");
      await cache.put(page, new Response("copia"));
      const served = networkFirst(t.deps, page, { ...PAGES, fallback: async () => undefined });
      await vi.advanceTimersByTimeAsync(3000);
      expect(await (await served).text()).toBe("copia");
      release();

      const otra = new Request("https://pruebas.3bstays.com/casa/CT-9999");
      const waiting = networkFirst(t.deps, otra, { ...PAGES, fallback: async () => undefined });
      await vi.advanceTimersByTimeAsync(5000);
      release();
      expect(await (await waiting).text()).toBe("lenta");
    } finally {
      vi.useRealTimers();
    }
  });

  it("no guarda respuestas que no son 200 (enlace parado, error)", async () => {
    const t = setup(async () => new Response("parado", { status: 410 }));
    expect((await networkFirst(t.deps, page, { ...PAGES, fallback: async () => undefined })).status).toBe(410);
    await t.settle();
    expect(t.mem.size("pages")).toBe(0);
  });
});
