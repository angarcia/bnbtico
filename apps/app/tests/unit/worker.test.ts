// Costura HTTP del worker: peticiones en proceso a la app Hono, con el fake en lugar de PostgREST.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type CacheLike, type Env } from "../../src/server/app";
import type { Seeded } from "../contract/harness";
import { fakeHarness } from "./fake-harness";

const template = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const SHELL = "<!doctype html><title>shell</title>";
const ORIGIN = "https://nueva.bnbtico.com";

function memoryCache(): CacheLike & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    async match(key) {
      return store.get(key)?.clone();
    },
    async put(key, res) {
      store.set(key, res.clone());
    },
    async delete(key) {
      return store.delete(key);
    },
  };
}

function setup(over: Partial<Env> = {}) {
  const h = fakeHarness();
  const cache = memoryCache();
  const purgeFetch = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ success: true }));
  const api = h.anon;
  const spy = { getPublic: vi.spyOn(api, "getPublic") };
  const app = createApp({ listings: () => api, cache: () => cache, purgeFetch: purgeFetch as unknown as typeof fetch });
  const env: Env = {
    ENVIRONMENT: "pruebas",
    SUPABASE_URL: "http://supabase.test",
    SUPABASE_ANON_KEY: "anon",
    PURGE_SECRET: "s3creto",
    CF_ZONE_ID: "zona",
    CF_PURGE_TOKEN: "token",
    CF_VERSION_METADATA: { id: "v1" },
    ASSETS: {
      async fetch(input: Request | URL | string) {
        const url = new URL(input instanceof Request ? input.url : input);
        return new Response(url.pathname === "/" ? template : SHELL, { headers: { "content-type": "text/html" } });
      },
    },
    ...over,
  };
  const request = (path: string, init?: RequestInit) => app.request(`${ORIGIN}${path}`, init, env);
  return { h, cache, purgeFetch, request, spy, env };
}

const ssrData = (html: string) => JSON.parse(/<script type="application\/json" id="ssr-data">([\s\S]*?)<\/script>/.exec(html)![1]!);

describe("worker · ficha /casa/CT-####", () => {
  let t: ReturnType<typeof setup>;
  let casa: Seeded;

  beforeEach(async () => {
    t = setup();
    casa = await t.h.seed({ status: "active", photos: 6, draft: { title: 'Casa "Sol" <y> Mar', zone: "Playa Negra", canton: "Talamanca", capacity: 4, nightlyPriceCrc: 95000 } });
  });

  it("responde la ficha renderizada en servidor", async () => {
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toMatch(/<div id="root">[\s\S]*<h1[^>]*>Casa &quot;Sol&quot; &lt;y&gt; Mar<\/h1>/);
    expect(html).toContain("₡95\u00a0000");
    expect(html).toContain("el precio final lo acuerda con el propietario");
    expect(html).toContain("Contactar por WhatsApp");
    expect(html).toContain("1 / 6");
  });

  it("cabecera: título, descripción, Open Graph, Twitter, canónica de producción y precarga del hero", async () => {
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    const cover = casa.photoPaths[0]!;
    const desc = "Alojamiento completo en Playa Negra, Limón · 4 personas · ₡95\u00a0000 por noche · orientativo";
    expect(html).toContain("<title>Casa &quot;Sol&quot; &lt;y&gt; Mar · bnbtico</title>");
    expect(html).toContain(`<meta name="description" content="${desc}" />`);
    expect(html).toContain(`<link rel="canonical" href="https://bnbtico.com/casa/${casa.publicId}" />`);
    expect(html).toContain(`<meta property="og:url" content="https://bnbtico.com/casa/${casa.publicId}" />`);
    expect(html).toContain('<meta property="og:title" content="Casa &quot;Sol&quot; &lt;y&gt; Mar" />');
    expect(html).toContain(`<meta property="og:description" content="${desc}" />`);
    expect(html).toContain(`<meta property="og:image" content="http://supabase.test/storage/v1/object/public/listings/${cover}" />`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain(`<link rel="preload" as="image" href="http://supabase.test/storage/v1/object/public/listings/${cover}" fetchpriority="high" />`);
    expect(html).not.toContain("<title>bnbtico</title>");
  });

  it("con fotos subidas en tres variantes: Open Graph y precarga con la de 800, hero con srcset 480/800", async () => {
    const folder = `${casa.id}/1c9e5d2f-3e4b-4c6d-9e0f-1a2b3c4d5e6f`;
    t.h.db.photos.find((p) => p.listingId === casa.id && p.position === 0)!.path = folder;
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    const base = `http://supabase.test/storage/v1/object/public/listings/${folder}`;
    expect(html).toContain(`<meta property="og:image" content="${base}/800.jpg" />`);
    expect(html).toContain(`<link rel="preload" as="image" href="${base}/800.jpg"`);
    expect(html).toContain(`srcSet="${base}/480.jpg 480w, ${base}/800.jpg 800w"`);
  });

  it("cabecera Link con la precarga del hero (Cloudflare la adelanta como 103 Early Hints), también desde la caché", async () => {
    const folder = `${casa.id}/1c9e5d2f-3e4b-4c6d-9e0f-1a2b3c4d5e6f`;
    t.h.db.photos.find((p) => p.listingId === casa.id && p.position === 0)!.path = folder;
    const base = `http://supabase.test/storage/v1/object/public/listings/${folder}`;
    const expected = `<${base}/800.jpg>; rel=preload; as=image; fetchpriority=high; imagesrcset="${base}/480.jpg 480w, ${base}/800.jpg 800w"; imagesizes="100vw"`;
    const first = await t.request(`/casa/${casa.publicId}`);
    expect(first.headers.get("link")).toBe(expected);
    const cached = await t.request(`/casa/${casa.publicId}`);
    expect(t.spy.getPublic).toHaveBeenCalledTimes(1);
    expect(cached.headers.get("link")).toBe(expected);
  });

  it("sin fotos no hay cabecera Link; las páginas de estado tampoco la llevan", async () => {
    const sinFotos = await t.h.seed({ status: "active", photos: 0 });
    expect((await t.request(`/casa/${sinFotos.publicId}`)).headers.get("link")).toBeNull();
    expect((await t.request("/casa/CT-999999")).headers.get("link")).toBeNull();
  });

  it("incrusta la casa en un JSON no ejecutable y escapado", async () => {
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    const raw = /<script type="application\/json" id="ssr-data">([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(raw).not.toContain("<");
    const data = ssrData(html);
    expect(data.page).toBe("listing");
    expect(data.listing).toMatchObject({ publicId: casa.publicId, title: 'Casa "Sol" <y> Mar', nightlyPriceCrc: 95000 });
    expect(data.listing).not.toHaveProperty("whatsappPhone");
    expect(data.base).toBe(ORIGIN);
  });

  it("cabeceras de caché largas en el CDN y la siguiente petición sale de la caché", async () => {
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
    expect([...t.cache.store.keys()]).toEqual([`${ORIGIN}/casa/${casa.publicId}?__v=v1`]);
    await t.request(`/casa/${casa.publicId}?utm_source=whatsapp`);
    expect(t.spy.getPublic).toHaveBeenCalledTimes(1);
  });

  it("un id en minúsculas redirige a la URL canónica", async () => {
    const res = await t.request(`/casa/${casa.publicId.toLowerCase()}`);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`/casa/${casa.publicId}`);
  });
});

describe("worker · enlaces que no se muestran", () => {
  it("una casa que no existe responde 404 con su página y sin indexar", async () => {
    const t = setup();
    const res = await t.request("/casa/CT-999999");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Este enlace no existe");
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(ssrData(html)).toEqual({ page: "missing" });
  });

  it("un id mal formado responde 404 sin consultar", async () => {
    const t = setup();
    const res = await t.request("/casa/no-es-un-id");
    expect(res.status).toBe(404);
    expect(t.spy.getPublic).not.toHaveBeenCalled();
  });

  it("un borrador nunca enviado no existe para el público", async () => {
    const t = setup();
    const draft = await t.h.seed({ status: "draft" });
    expect((await t.request(`/casa/${draft.publicId}`)).status).toBe(404);
  });

  it("una casa revisada y luego oculta responde 410 «Este enlace ya no está activo»", async () => {
    const t = setup();
    for (const status of ["reopened", "changes", "rejected", "review"] as const) {
      const s = await t.h.seed({ status });
      const res = await t.request(`/casa/${s.publicId}`);
      expect(res.status).toBe(410);
      const html = await res.text();
      expect(html).toContain("Este enlace ya no está activo");
      expect(ssrData(html)).toEqual({ page: "blocked" });
    }
  });

  it("si la base falla, 503 sin guardar en caché", async () => {
    const t = setup();
    const casa = await t.h.seed({ status: "active" });
    t.spy.getPublic.mockRejectedValueOnce(new Error("caída"));
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.status).toBe(503);
    expect(await res.text()).toContain("No pudimos cargar esta casa");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(t.cache.store.size).toBe(0);
  });
});

describe("worker · sin configuración de Supabase", () => {
  it("la ficha y el sitemap responden 503 con su página, no un 500 vacío", async () => {
    const t = setup();
    const app = createApp({
      listings: () => {
        throw new Error("supabaseKey is required.");
      },
      cache: () => null,
      purgeFetch: fetch,
    });
    const ficha = await app.request(`${ORIGIN}/casa/CT-1000`, {}, t.env);
    expect(ficha.status).toBe(503);
    expect(await ficha.text()).toContain("No pudimos cargar esta casa");
    const sitemap = await app.request(`${ORIGIN}/sitemap.xml`, {}, t.env);
    expect(sitemap.status).toBe(503);
    expect(sitemap.headers.get("cache-control")).toBe("no-store");
  });
});

describe("worker · purga de la ficha", () => {
  it("rechaza sin secreto o con uno equivocado", async () => {
    const t = setup();
    expect((await t.request("/_purge/CT-1000", { method: "POST" })).status).toBe(401);
    expect((await t.request("/_purge/CT-1000", { method: "POST", headers: { authorization: "Bearer otro" } })).status).toBe(401);
    expect(t.purgeFetch).not.toHaveBeenCalled();
  });

  it("purga la URL de la ficha por la API de la zona y la borra de la caché local", async () => {
    const t = setup();
    const casa = await t.h.seed({ status: "active" });
    await t.request(`/casa/${casa.publicId}`);
    const res = await t.request(`/_purge/${casa.publicId}`, { method: "POST", headers: { authorization: "Bearer s3creto" } });
    expect(res.status).toBe(200);
    const key = `${ORIGIN}/casa/${casa.publicId}?__v=v1`;
    expect(t.purgeFetch).toHaveBeenCalledWith("https://api.cloudflare.com/client/v4/zones/zona/purge_cache", expect.objectContaining({ method: "POST", body: JSON.stringify({ files: [key] }) }));
    expect((t.purgeFetch.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBe("Bearer token");
    expect(t.cache.store.has(key)).toBe(false);
  });

  it("sin configuración de purga responde 503", async () => {
    const t = setup({ CF_PURGE_TOKEN: undefined });
    expect((await t.request("/_purge/CT-1000", { method: "POST", headers: { authorization: "Bearer s3creto" } })).status).toBe(503);
  });

  it("un id mal formado es 400", async () => {
    const t = setup();
    expect((await t.request("/_purge/nada", { method: "POST", headers: { authorization: "Bearer s3creto" } })).status).toBe(400);
  });
});

describe("worker · sitemap, robots y shell", () => {
  it("el sitemap lista solo las casas activas con el dominio de producción y se cachea una hora", async () => {
    const t = setup({ ENVIRONMENT: "production", LAUNCHED: "true" });
    const a = await t.h.seed({ status: "active" });
    await t.h.seed({ status: "draft" });
    const res = await t.request("/sitemap.xml");
    expect(res.headers.get("content-type")).toMatch(/application\/xml/);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
    const xml = await res.text();
    expect(xml.match(/<loc>/g)).toHaveLength(2);
    expect(xml).toContain("<loc>https://bnbtico.com/</loc>");
    expect(xml).toContain(`<loc>https://bnbtico.com/casa/${a.publicId}</loc>`);
  });

  it("robots.txt bloquea todo fuera de producción", async () => {
    expect(await (await setup().request("/robots.txt")).text()).toBe("User-agent: *\nDisallow: /\n");
    expect(await (await setup({ ENVIRONMENT: "production" }).request("/robots.txt")).text()).toContain("Allow: /");
  });

  it("cualquier otra ruta recibe el shell de la SPA", async () => {
    expect(await (await setup().request("/explorar")).text()).toBe(SHELL);
  });
});

describe("worker · cabeceras de seguridad del HTML", () => {
  it("la ficha lleva CSP estricta con el Supabase del entorno y sin Turnstile; también cuando sale de la caché", async () => {
    const t = setup();
    const casa = await t.h.seed({ status: "active" });
    for (let i = 0; i < 2; i++) {
      const res = await t.request(`/casa/${casa.publicId}`);
      const csp = res.headers.get("content-security-policy")!;
      expect(csp).toContain("script-src 'self';");
      expect(csp).toContain("style-src 'self';");
      expect(csp).toContain("connect-src 'self' http://supabase.test https://tile.openstreetmap.org");
      expect(csp).toContain("img-src 'self' data: blob: http://supabase.test https://tile.openstreetmap.org");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).not.toContain("challenges.cloudflare.com");
      expect(csp).not.toContain("unsafe-inline");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("las páginas de estado también la llevan", async () => {
    const res = await setup().request("/casa/CT-9999");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-security-policy")).toContain("script-src 'self'");
  });

  it("en desarrollo (Vite inyecta scripts en línea) no se envía", async () => {
    const t = setup();
    const app = createApp({ listings: () => t.h.anon, cache: () => null, purgeFetch: fetch, securityHeaders: false });
    const res = await app.request(`${ORIGIN}/casa/CT-9999`, {}, t.env);
    expect(res.headers.get("content-security-policy")).toBeNull();
  });
});

describe("worker · balizas /vitals, /errors y /events", () => {
  type Written = { table: string; row: Record<string, unknown> };
  function beacons(writer: "ok" | "none" = "ok") {
    const t = setup();
    const written: Written[] = [];
    const app = createApp({
      listings: () => t.h.anon,
      cache: () => null,
      purgeFetch: fetch,
      telemetry: () => (writer === "none" ? null : { insert: async (table, row) => void written.push({ table, row: row as Record<string, unknown> }) }),
    });
    const post = (path: string, body: string, headers: Record<string, string> = {}) =>
      app.request(`${ORIGIN}${path}`, { method: "POST", body, headers: { "content-type": "text/plain", "cf-ipcountry": "CR", ...headers } }, t.env);
    return { post, written };
  }

  const valid = {
    "/vitals": { name: "LCP", value: 1234, rating: "good", id: "v5-1", path: "/casa/CT-1015", build: "abc" },
    "/errors": { kind: "error", message: "Boom", stack: "at x", path: "/explorar", build: "abc" },
    "/events": { name: "whatsapp_tap", listing: "CT-1015", path: "/casa/CT-1015", build: "abc" },
  } as const;
  const tables = { "/vitals": "web_vitals", "/errors": "client_errors", "/events": "events" } as const;

  for (const path of ["/vitals", "/errors", "/events"] as const) {
    it(`${path}: acepta una baliza válida y la escribe con el país`, async () => {
      const b = beacons();
      const res = await b.post(path, JSON.stringify(valid[path]), { origin: ORIGIN });
      expect(res.status).toBe(204);
      expect(b.written).toHaveLength(1);
      expect(b.written[0]!.table).toBe(tables[path]);
      expect(b.written[0]!.row).toMatchObject({ country: "CR", build: "abc", path: valid[path].path });
    });

    it(`${path}: rechaza una baliza malformada sin escribir`, async () => {
      const b = beacons();
      expect((await b.post(path, "{rota")).status).toBe(400);
      expect((await b.post(path, JSON.stringify({ ...valid[path], path: 7 }))).status).toBe(400);
      expect(b.written).toHaveLength(0);
    });

    it(`${path}: rechaza una baliza demasiado grande sin escribir`, async () => {
      const b = beacons();
      const big = JSON.stringify({ ...valid[path], pad: "x".repeat(9000) });
      expect((await b.post(path, big)).status).toBe(413);
      expect((await b.post(path, "{}", { "content-length": "999999" })).status).toBe(413);
      expect(b.written).toHaveLength(0);
    });
  }

  it("/events: inquiry_created (fase 3) se escribe con la casa y nada personal", async () => {
    const b = beacons();
    const res = await b.post("/events", JSON.stringify({ name: "inquiry_created", listing: "CT-1015", path: "/casa/CT-1015?contacto=1", build: "abc" }), { origin: ORIGIN });
    expect(res.status).toBe(204);
    expect(b.written).toEqual([{ table: "events", row: { name: "inquiry_created", listing_public_id: "CT-1015", page: "ficha", path: "/casa/CT-1015", build: "abc", country: "CR" } }]);
  });

  it("rechaza balizas de otro origen", async () => {
    const b = beacons();
    expect((await b.post("/events", JSON.stringify(valid["/events"]), { origin: "https://malo.example" })).status).toBe(403);
    expect(b.written).toHaveLength(0);
  });

  it("sin país conocido guarda null; un país raro también es null", async () => {
    const b = beacons();
    await b.post("/events", JSON.stringify(valid["/events"]), { "cf-ipcountry": "" });
    await b.post("/events", JSON.stringify(valid["/events"]), { "cf-ipcountry": "<script>" });
    expect(b.written.map((w) => w.row.country)).toEqual([null, null]);
  });

  it("sin clave de servicio responde 204 y descarta (el navegador no reintenta)", async () => {
    const b = beacons("none");
    expect((await b.post("/events", JSON.stringify(valid["/events"]))).status).toBe(204);
  });

});
