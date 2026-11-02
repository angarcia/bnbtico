// Costura HTTP del worker: peticiones en proceso a la app Hono, con el fake en lugar de PostgREST.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type CacheLike, type Env } from "../../src/server/app";
import type { Seeded } from "../contract/harness";
import { addDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
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
  const spy = { getPublic: vi.spyOn(api, "getPublic"), getPublicDays: vi.spyOn(api, "getPublicDays") };
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
    casa = await t.h.seed({ status: "active", photos: 6, draft: { title: 'Casa "Sol" <y> Mar', zone: "Playa Negra", zoneSource: "other", zoneId: null, canton: "Talamanca", capacity: 4, nightlyPriceCrc: 95000 } });
  });

  it("responde la ficha renderizada en servidor", async () => {
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toMatch(/<div id="root">[\s\S]*<h1[^>]*>Casa &quot;Sol&quot; &lt;y&gt; Mar<\/h1>/);
    expect(html).toContain("₡95\u00a0000");
    expect(html).toContain("· orientativo");
    // Revisión UX A10: la persona que alquila, bajo el nombre (iniciales y nombre de pila), en vez de la etiqueta suelta.
    expect(html).toMatch(/data-testid="host-line"[\s\S]*?class="avatar[^"]*"[^>]*>[A-ZÁÉÍÓÚÑ]{1,2}<\/span>[\s\S]*?Anfitrión · WhatsApp verificado/);
    expect(html).not.toContain(" · ubicación aproximada");
    expect(html).not.toMatch(/class="badge badge-ok"[^>]*>[\s\S]{0,200}WhatsApp verificado/);
    expect(html).toContain("fechas, precio y pago los acuerda directamente con el anfitrión");
    expect(html).toContain("Contactar por WhatsApp");
    expect(html).toContain("1 / 6");
  });

  it("el botón de contacto llega como caja apagada sin interacción (se activa al hidratar) y nada de la hoja", async () => {
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    expect(html).toMatch(/<span class="btn btn-wa is-pending" aria-hidden="true">[\s\S]*?Contactar por WhatsApp<\/span>/);
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Contactar por WhatsApp/);
    expect(html).not.toContain("Escríbale a");
    expect(html).not.toContain("disponible pronto");
  });

  it("una casa que no recibe consultas llega con el botón deshabilitado «No disponible por ahora»", async () => {
    await t.h.setClosed(casa.id, true);
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    expect(html).toMatch(/<button class="btn btn-wa" type="button" disabled="">[\s\S]*?No disponible por ahora<\/button>/);
    expect(html).not.toContain("Contactar por WhatsApp");
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

  it("sin descripción y con una foto: ni párrafo de descripción ni contador «1 / 1»", async () => {
    const sola = await t.h.seed({ status: "active", photos: 1, draft: { description: "" } });
    const html = await (await t.request(`/casa/${sola.publicId}`)).text();
    expect(html).toContain("<h1");
    expect(html).not.toContain('class="listing-description"');
    expect(html).not.toContain("1 / 1");
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

  it("ssr-data lleva los días de la casa (ocupados y precios especiales) para el calendario de la ficha", async () => {
    const today = costaRicaToday(Date.now());
    await t.h.putDay(casa.id, { day: addDays(today, 3), available: false, specialPriceCrc: null });
    await t.h.putDay(casa.id, { day: addDays(today, 5), available: true, specialPriceCrc: 120000 });
    const data = ssrData(await (await t.request(`/casa/${casa.publicId}`)).text());
    expect(data.days).toEqual([
      { day: addDays(today, 3), available: false, specialPriceCrc: null },
      { day: addDays(today, 5), available: true, specialPriceCrc: 120000 },
    ]);
  });

  it("la casa y sus días se piden a la vez, no uno tras otro", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    // La primera llamada espera; dentro, la segunda llega al fake de verdad.
    t.spy.getPublic.mockImplementationOnce(async (id) => {
      await held;
      return t.h.anon.getPublic(id);
    });
    const pending = t.request(`/casa/${casa.publicId}`);
    await vi.waitFor(() => expect(t.spy.getPublicDays).toHaveBeenCalledWith(casa.publicId));
    release();
    expect((await pending).status).toBe(200);
  });

  it("la ficha en la caché no vuelve a pedir los días; la clave de caché no cambia", async () => {
    await t.request(`/casa/${casa.publicId}`);
    await t.request(`/casa/${casa.publicId}`);
    expect(t.spy.getPublicDays).toHaveBeenCalledTimes(1);
    expect([...t.cache.store.keys()]).toEqual([`${ORIGIN}/casa/${casa.publicId}?__v=v1`]);
  });

  it("el HTML trae la sección «Disponibilidad» como caja vacía, sin la rejilla del calendario", async () => {
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    const body = html.slice(html.indexOf('<div id="root">'));
    expect(body).toMatch(/<span class="eyebrow">Disponibilidad<\/span><div class="listing-calendar" aria-hidden="true"><\/div>/);
    expect(body).not.toContain("month-grid");
    expect(body).not.toContain("gridcell");
    // Va tras las características y antes de la zona aproximada.
    expect(body.indexOf("Disponibilidad")).toBeGreaterThan(body.indexOf("feature-tiles"));
    expect(body.indexOf("Disponibilidad")).toBeLessThan(body.indexOf("Zona aproximada"));
  });

  it("una casa cerrada a consultas trae «Calendario cerrado» y su reapertura, sin caja del calendario", async () => {
    const reopen = addDays(costaRicaToday(Date.now()), 20);
    await t.h.setClosed(casa.id, true, reopen);
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    const body = html.slice(html.indexOf('<div id="root">'));
    expect(body).toContain("Calendario cerrado");
    expect(body).toMatch(/Calendario cerrado[\s\S]*Vuelve a estar disponible el/);
    expect(body).not.toContain('class="listing-calendar"');
  });

  it("si fallan los días, la ficha sale igual (200) sin «Disponibilidad», con days null, sin caché y con no-store", async () => {
    t.spy.getPublicDays.mockRejectedValueOnce(new Error("public_listing_days no existe"));
    const put = vi.spyOn(t.cache, "put");
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    const body = html.slice(html.indexOf('<div id="root">'));
    expect(body).toMatch(/<h1[^>]*>Casa &quot;Sol&quot;/);
    expect(body).not.toContain("Disponibilidad");
    expect(body).not.toContain("listing-calendar");
    expect(ssrData(html).days).toBeNull();
    expect(put).not.toHaveBeenCalled();
    expect(t.cache.store.size).toBe(0);
    // La siguiente visita lo vuelve a intentar y, con los días, ya se guarda.
    const again = await t.request(`/casa/${casa.publicId}`);
    expect(again.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
    expect(await again.text()).toContain("Disponibilidad");
    expect(t.cache.store.size).toBe(1);
  });

  it("la ficha usa el tipo de cambio vigente y ssr-data lleva el que usó (ticket 21)", async () => {
    t.h.db.putFxRate({ crcPerUsd: 400, day: "2026-10-28", source: "fawazahmed0" });
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    expect(ssrData(html).fx).toEqual({ crcPerUsd: 400, day: "2026-10-28", source: "fawazahmed0" });
    const body = html.slice(html.indexOf('<div id="root">'));
    // ₡95 000 / 400 = $238 (con la constante de antes, $186).
    expect(body).toContain("≈ $238");
    expect(body).not.toContain("$186");
    expect(body).toContain("tipo de referencia del 28 oct.");
    // Nada de atribución en la ficha, venga de donde venga el tipo.
    expect(body).not.toContain("Exchange Rate API");
  });

  it("sin tipos del cron, el inicial (510)", async () => {
    const html = await (await t.request(`/casa/${casa.publicId}`)).text();
    expect(ssrData(html).fx).toEqual({ crcPerUsd: 510, day: "2026-10-26", source: "constante" });
    expect(html).toContain("≈ $186");
  });

  it("si falla la lectura del tipo, la ficha sale con el inicial, sin caché y con no-store", async () => {
    vi.spyOn(t.h.anon, "fxRate").mockRejectedValueOnce(new Error("fx_rates no existe"));
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    expect(ssrData(html).fx).toMatchObject({ crcPerUsd: 510, source: "constante" });
    expect(t.cache.store.size).toBe(0);
  });

  it("si falla la casa, 503 sin caché aunque los días respondan", async () => {
    t.spy.getPublic.mockRejectedValueOnce(new Error("caída"));
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(t.cache.store.size).toBe(0);
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
    expect(html).toMatch(/<a href="\/explorar" class="btn btn-soft">Ver otras casas en el Caribe<\/a>/);
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
      expect(ssrData(html)).toEqual({ page: "blocked", reason: "other" });
      expect(html).toContain("Este anuncio no está disponible en este momento.");
      expect(html).toMatch(/<a href="\/explorar" class="btn btn-soft">Ver otras casas en el Caribe<\/a>/);
    }
  });

  it("el 410 dice el motivo: parada por el propietario o fuera del catálogo por la suscripción", async () => {
    const t = setup();
    const stopped = await t.h.seed({ status: "active" });
    await t.h.billing("owner").stop(stopped.id);
    const unpaid = await t.h.seed({ status: "active" });
    await t.h.setDaysLeft(unpaid.id, -1);
    await t.h.service.runDay();
    const reason = vi.spyOn(t.h.anon, "blockedReason");

    const a = await t.request(`/casa/${stopped.publicId}`);
    expect(a.status).toBe(410);
    const ha = await a.text();
    expect(ssrData(ha)).toEqual({ page: "blocked", reason: "stopped" });
    expect(ha).toContain("El anfitrión paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde bnbtico.");
    expect(ha).toContain("Si ya habló con el anfitrión por WhatsApp");
    expect(ha).not.toContain("Contactar por WhatsApp");

    const b = await t.request(`/casa/${unpaid.publicId}`);
    expect(b.status).toBe(410);
    const hb = await b.text();
    expect(ssrData(hb)).toEqual({ page: "blocked", reason: "payment" });
    expect(hb).toContain("Este anuncio está fuera del catálogo hasta que el anfitrión regularice su suscripción.");
    expect(b.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=60");
    expect(reason).toHaveBeenCalledTimes(2);
  });

  it("el motivo solo se pide en el camino bloqueado y, si falla (base sin la migración), sale el 410 de siempre", async () => {
    const t = setup();
    const reason = vi.spyOn(t.h.anon, "blockedReason");
    const active = await t.h.seed({ status: "active" });
    expect((await t.request(`/casa/${active.publicId}`)).status).toBe(200);
    const missing = await t.request("/casa/CT-9999");
    expect(missing.status).toBe(404);
    expect(reason).not.toHaveBeenCalled();

    const stopped = await t.h.seed({ status: "active" });
    await t.h.billing("owner").stop(stopped.id);
    reason.mockRejectedValueOnce(new Error("Could not find the function public.listing_blocked_reason"));
    const res = await t.request(`/casa/${stopped.publicId}`);
    expect(res.status).toBe(410);
    const html = await res.text();
    expect(ssrData(html)).toEqual({ page: "blocked", reason: "other" });
    expect(html).toContain("Este anuncio no está disponible en este momento.");
    expect(html).not.toContain("paró la suscripción");
  });

  it("si la base falla, 503 sin guardar en caché", async () => {
    const t = setup();
    const casa = await t.h.seed({ status: "active" });
    t.spy.getPublic.mockRejectedValueOnce(new Error("caída"));
    const res = await t.request(`/casa/${casa.publicId}`);
    expect(res.status).toBe(503);
    const html = await res.text();
    expect(html).toContain("No pudimos cargar esta casa");
    // Revisión UX N4: reintentar (enlace a la misma página) y, en contorno, ir a Explorar.
    expect(html).toMatch(/<a href="" class="btn btn-primary">Intentar de nuevo<\/a>/);
    expect(html).toMatch(/<a href="\/explorar" class="btn btn-ghost">Ir a Explorar<\/a>/);
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

  it("sin configuración de purga responde 503 y no toca la caché", async () => {
    const t = setup({ CF_PURGE_TOKEN: undefined });
    const casa = await t.h.seed({ status: "active" });
    await t.request(`/casa/${casa.publicId}`);
    expect((await t.request(`/_purge/${casa.publicId}`, { method: "POST", headers: { authorization: "Bearer s3creto" } })).status).toBe(503);
    expect(t.cache.store.size).toBe(1);
  });

  it("en local (sin zona de Cloudflare) borra la copia de la caché del worker y responde 200", async () => {
    const t = setup({ ENVIRONMENT: "local", CF_ZONE_ID: undefined, CF_PURGE_TOKEN: undefined });
    const casa = await t.h.seed({ status: "active" });
    await t.request(`/casa/${casa.publicId}`);
    const res = await t.request(`/_purge/${casa.publicId}`, { method: "POST", headers: { authorization: "Bearer s3creto" } });
    expect(res.status).toBe(200);
    expect(t.cache.store.size).toBe(0);
    expect(t.purgeFetch).not.toHaveBeenCalled();
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
      expect(csp).not.toContain("photon.komoot.io");
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

  it("/events: search_help_tap (fase 6) se escribe solo con lo de siempre", async () => {
    const b = beacons();
    const body = { name: "search_help_tap", path: "/explorar?prov=Lim%C3%B3n&ppl=4", build: "abc", text: "Hola, estoy buscando casa", prov: "Limón" };
    const res = await b.post("/events", JSON.stringify(body), { origin: ORIGIN });
    expect(res.status).toBe(204);
    expect(b.written).toEqual([{ table: "events", row: { name: "search_help_tap", page: "explorar", path: "/explorar", build: "abc", country: "CR" } }]);
  });

  it("/events: monthly_filter_tap se escribe sin casa y sin los filtros", async () => {
    const b = beacons();
    const res = await b.post("/events", JSON.stringify({ name: "monthly_filter_tap", path: "/explorar?mensual=1&min=40000", build: "abc" }), { origin: ORIGIN });
    expect(res.status).toBe(204);
    expect(b.written).toEqual([{ table: "events", row: { name: "monthly_filter_tap", page: "explorar", path: "/explorar", build: "abc", country: "CR" } }]);
  });

  it("/events: search_submit escribe search_flags y deja fuera la consulta", async () => {
    const b = beacons();
    const res = await b.post("/events", JSON.stringify({ name: "search_submit", flags: ["zona", "fechas"], path: "/explorar/buscar?zona=704-cocles&llegada=2026-11-23", build: "abc" }), { origin: ORIGIN });
    expect(res.status).toBe(204);
    expect(b.written).toEqual([{ table: "events", row: { name: "search_submit", search_flags: ["zona", "fechas"], page: "buscar", path: "/explorar/buscar", build: "abc", country: "CR" } }]);
  });

  it("/events: si la base rechaza la fila (p. ej. un nombre nuevo sin su migración) responde 204 igual y lo registra", async () => {
    const t = setup();
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((m: unknown) => void errors.push(String(m)));
    try {
      const app = createApp({
        listings: () => t.h.anon,
        cache: () => null,
        purgeFetch: fetch,
        telemetry: () => ({ insert: () => Promise.reject(new Error("PostgREST 400 en events: violates check constraint events_name_check")) }),
      });
      const res = await app.request(`${ORIGIN}/events`, { method: "POST", body: JSON.stringify({ name: "search_help_tap", path: "/explorar", build: "abc" }), headers: { origin: ORIGIN } }, t.env);
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      await vi.waitFor(() => expect(errors.some((e) => e.includes("beacon_write_failed") && e.includes("events_name_check"))).toBe(true));
    } finally {
      spy.mockRestore();
    }
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

describe("worker · botón de propietarios de la portada", () => {
  const PORTADA = '<main><!--cta-propietarios--><p class="soon-later">Abrimos pronto en el Caribe sur.</p><!--/cta-propietarios--></main>';
  const PORTADA_WA = '<main><!--cta-propietarios--><a class="soon-cta" href="https://wa.me/50660000000" rel="noopener">Quiero publicar mi casa gratis</a><!--/cta-propietarios--></main>';
  const assets = (portada: string): Env["ASSETS"] => ({
    async fetch(input: Request | URL | string) {
      const url = new URL(input instanceof Request ? input.url : input);
      return new Response(url.pathname === "/portada" ? portada : SHELL, { headers: { "content-type": "text/html" } });
    },
  });

  it("en pruebas, /?pronto=1 enlaza al asistente (también cuando el build puso WhatsApp)", async () => {
    for (const portada of [PORTADA, PORTADA_WA]) {
      const html = await (await setup({ ENVIRONMENT: "pruebas", ASSETS: assets(portada) }).request("/?pronto=1")).text();
      expect(html).toContain('<a class="soon-cta" href="/publicar">Publicar mi casa</a>');
      expect(html).not.toContain("Abrimos pronto");
      expect(html).not.toContain("wa.me");
    }
  });

  it("producción antes del lanzamiento no cambia: ni el 200 ni el 404 llevan el asistente", async () => {
    for (const portada of [PORTADA, PORTADA_WA]) {
      const t = setup({ ENVIRONMENT: "production", ASSETS: assets(portada) });
      const res = await t.request("/");
      expect(await res.text()).toBe(portada);
      const other = await t.request("/explorar");
      expect(other.status).toBe(404);
      expect(await other.text()).toBe(portada);
    }
  });

  it("producción lanzada: /?pronto=1 enlaza al asistente; la CSP de la portada no cambia", async () => {
    const before = await setup({ ENVIRONMENT: "production", ASSETS: assets(PORTADA) }).request("/");
    const res = await setup({ ENVIRONMENT: "production", LAUNCHED: "true", ASSETS: assets(PORTADA) }).request("/?pronto=1");
    expect(await res.text()).toContain('href="/publicar"');
    expect(res.headers.get("content-security-policy")).toBe(before.headers.get("content-security-policy"));
  });
});

