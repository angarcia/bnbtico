// Portada estática (ticket 13): public/portada.html servida por el worker en `/` (producción antes del lanzamiento, o
// `?pronto=1` en cualquier entorno) y el modo «solo portada» del worker de producción.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { withWizardCta } from "../../src/domain/portada";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "../../src/domain/seo";
import { createApp, type Env } from "../../src/server/app";
import { fakeHarness } from "./fake-harness";

const PUBLIC = new URL("../../public/", import.meta.url);
const portada = readFileSync(new URL("portada.html", PUBLIC), "utf8");
const SHELL = "<!doctype html><title>shell</title>";
const ORIGIN = "https://bnbtico.com";

function setup(over: Partial<Env> = {}) {
  const h = fakeHarness();
  const api = h.anon;
  const sitemap = vi.spyOn(api, "sitemap");
  const getPublic = vi.spyOn(api, "getPublic");
  const assets = vi.fn(async (input: Request | URL | string) => {
    const url = new URL(input instanceof Request ? input.url : input);
    // Workers Static Assets con html_handling por defecto: /portada sirve portada.html.
    if (url.pathname === "/portada") return new Response(portada, { headers: { "content-type": "text/html; charset=utf-8", "content-security-policy": "la-del-shell" } });
    if (url.pathname === "/" || !/\.[a-z0-9]+$/i.test(url.pathname)) return new Response(SHELL, { headers: { "content-type": "text/html" } });
    return new Response("fichero", { headers: { "content-type": "application/octet-stream" } });
  });
  const app = createApp({ listings: () => api, cache: () => null, purgeFetch: fetch });
  const env: Env = { ENVIRONMENT: "pruebas", SUPABASE_URL: "http://supabase.test", SUPABASE_ANON_KEY: "anon", ASSETS: { fetch: assets }, ...over };
  const request = (path: string, init?: RequestInit) => app.request(`${ORIGIN}${path}`, init, env);
  return { h, request, assets, sitemap, getPublic };
}

const production = { ENVIRONMENT: "production" as const };

describe("portada · el HTML estático", () => {
  it("título, descripción, canónica, Open Graph y Twitter con bnbtico.com y la imagen OG de 1200×630", () => {
    expect(portada).toContain('<html lang="es-CR">');
    expect(portada).toContain(`<title>${SITE_TITLE}</title>`);
    expect(portada).toContain(`<meta name="description" content="${SITE_DESCRIPTION}" />`);
    expect(portada).toContain(`<link rel="canonical" href="${SITE_URL}/" />`);
    for (const [k, v] of [
      ["og:type", "website"],
      ["og:locale", "es_CR"],
      ["og:url", `${SITE_URL}/`],
      ["og:site_name", "bnbtico"],
      ["og:title", SITE_TITLE],
      ["og:description", SITE_DESCRIPTION],
      ["og:image", `${SITE_URL}/og.jpg`],
      ["og:image:width", "1200"],
      ["og:image:height", "630"],
    ]) expect(portada, k).toContain(`<meta property="${k}" content="${v}" />`);
    expect(portada).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(portada).toContain(`<meta name="twitter:image" content="${SITE_URL}/og.jpg" />`);
  });

  it("JSON-LD de Organization y WebSite (dato, no se ejecuta)", () => {
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(portada)![1]!);
    const [org, web] = ld["@graph"];
    expect(org).toMatchObject({ "@type": "Organization", "@id": `${SITE_URL}/#org`, url: SITE_URL, areaServed: "Costa Rica" });
    expect(web).toMatchObject({ "@type": "WebSite", url: SITE_URL, description: SITE_DESCRIPTION, inLanguage: "es-CR", publisher: { "@id": `${SITE_URL}/#org` } });
    expect(existsSync(new URL(org.logo.replace(SITE_URL + "/", ""), PUBLIC))).toBe(true);
  });

  it("sin scripts ejecutables, sin estilos en línea y sin terceros (ni Google Analytics)", () => {
    const scripts = [...portada.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]!);
    expect(scripts).toEqual([' type="application/ld+json"']);
    expect(portada).not.toMatch(/<style\b|\sstyle=|\son[a-z]+=/i);
    expect(portada).not.toMatch(/googletagmanager|gtag|https?:\/\/(?!bnbtico\.com|schema\.org)/);
  });

  it("todo lo que enlaza existe en public/", () => {
    const refs = [...portada.matchAll(/(?:src|href|srcset)="([^"]+)"/g)].flatMap((m) => m[1]!.split(",").map((s) => s.trim().split(" ")[0]!));
    const local = refs.filter((r) => r.startsWith("/") && r !== "/");
    expect(local.length).toBeGreaterThan(3);
    for (const r of local) expect(existsSync(new URL(r.slice(1), PUBLIC)), r).toBe(true);
    expect(existsSync(new URL("og.jpg", PUBLIC))).toBe(true);
  });

  it("el copy de la portada vieja, tratando de usted", () => {
    expect(portada).toContain("Alquile en el Caribe de Costa Rica, directo con quien lo recibe");
    expect(portada).toContain("Muy pronto");
    expect(portada).toContain("Qué es bnbtico");
    // Revisión UX C1: la oferta pasa a su tarjeta bajo la foto.
    expect(portada).toContain("Las primeras 50 casas: 12 meses gratis.");
    expect(portada).toContain("<!--cta-propietarios-->");
    expect(portada).toContain("Después, ₡2 900 al mes por casa"); // precio decidido el 2026-10-27
  });
});

describe("portada · en pruebas y local", () => {
  it("`/` sigue siendo el shell de la SPA (el router lleva a Explorar)", async () => {
    const t = setup();
    const res = await t.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SHELL);
  });

  it("`/?pronto=1` muestra la portada con la CSP estricta sin Turnstile ni Supabase", async () => {
    const t = setup();
    const res = await t.request("/?pronto=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(await res.text()).toBe(withWizardCta(portada));
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("script-src 'self';");
    expect(csp).not.toContain("challenges.cloudflare.com");
    expect(csp).not.toContain("supabase.test");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=3600");
  });

  it("HEAD / responde 200, también con ?pronto=1", async () => {
    const t = setup();
    expect((await t.request("/", { method: "HEAD" })).status).toBe(200);
    expect((await t.request("/?pronto=1", { method: "HEAD" })).status).toBe(200);
  });
});

describe("portada · producción antes del lanzamiento (LAUNCHED distinto de «true»)", () => {
  it("`/` es la portada y HEAD / responde 200", async () => {
    const t = setup(production);
    const res = await t.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(portada);
    const head = await t.request("/", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type")).toMatch(/text\/html/);
  });

  it("las rutas de la app y la ficha responden 404 con la portada, sin tocar Supabase", async () => {
    const t = setup(production);
    for (const path of ["/explorar", "/cuenta", "/admin", "/casa/CT-1015", "/index.html", "/sw.js", "/manifest.webmanifest", "/assets/index-abc.js"]) {
      const res = await t.request(path);
      expect(res.status, path).toBe(404);
      expect(await res.text(), path).toBe(portada);
    }
    expect(t.getPublic).not.toHaveBeenCalled();
  });

  it("purga y balizas no existen todavía", async () => {
    const t = setup({ ...production, PURGE_SECRET: "s" });
    expect((await t.request("/_purge/CT-1015", { method: "POST", headers: { authorization: "Bearer s" } })).status).toBe(404);
    expect((await t.request("/vitals", { method: "POST", body: "{}" })).status).toBe(404);
  });

  it("los ficheros de la portada pasan a los estáticos", async () => {
    const t = setup(production);
    for (const path of ["/og.jpg", "/favicon.ico", "/portada/portada.css", "/portada/playa-negra-800.jpg", "/fonts/outfit-latin.woff2", "/icons/icono-512.png"]) {
      const res = await t.request(path);
      expect(res.status, path).toBe(200);
      expect(await res.text(), path).toBe("fichero");
    }
  });

  it("robots indexa y el sitemap lista solo la portada, sin consultar casas", async () => {
    const t = setup(production);
    expect(await (await t.request("/robots.txt")).text()).toContain("Allow: /");
    const xml = await (await t.request("/sitemap.xml")).text();
    expect(xml.match(/<loc>/g)).toHaveLength(1);
    expect(xml).toContain("<loc>https://bnbtico.com/</loc>");
    expect(t.sitemap).not.toHaveBeenCalled();
  });

  it("con LAUNCHED=true la app entera: `/` es el shell y la ficha funciona", async () => {
    const t = setup({ ...production, LAUNCHED: "true" });
    expect(await (await t.request("/")).text()).toBe(SHELL);
    expect(await (await t.request("/?pronto=1")).text()).toBe(withWizardCta(portada));
    const casa = await t.h.seed({ status: "active" });
    expect((await t.request(`/casa/${casa.publicId}`)).status).toBe(200);
    expect(await (await t.request("/explorar")).text()).toBe(SHELL);
  });
});

/** wrangler.jsonc sin comentarios de línea completa (las URL llevan `//` dentro de cadenas). */
const wrangler = JSON.parse(
  readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n"),
);

describe("wrangler.jsonc · preparado para el corte", () => {
  it("`/` pasa por el worker (portada con ?pronto=1)", () => {
    expect(wrangler.assets.run_worker_first).toContain("/");
  });

  it("producción: solo portada (LAUNCHED=false), todo pasa por el worker y sin rutas activas todavía", () => {
    const p = wrangler.env.production;
    expect(p.vars).toMatchObject({ ENVIRONMENT: "production", LAUNCHED: "false" });
    expect(p.assets).toMatchObject({ binding: "ASSETS", run_worker_first: true });
    expect(p.routes ?? []).toEqual([]);
    expect(p.workers_dev).toBe(false);
  });

  it("pruebas sigue en nueva.bnbtico.com hasta el corte", () => {
    expect(wrangler.env.pruebas.routes).toEqual([{ pattern: "nueva.bnbtico.com", custom_domain: true }]);
  });
});
