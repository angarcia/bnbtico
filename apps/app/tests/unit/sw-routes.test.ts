import { describe, expect, it } from "vitest";
import { precacheList, strategyFor } from "../../src/sw/routes";

const ORIGIN = "https://nueva.bnbtico.com";
const SUPABASE = "https://bpxiggdzgzolcazaaboj.supabase.co";
const PRECACHED = new Set(["/", "/assets/index-abc.js", "/assets/index-abc.css", "/fonts/outfit-latin.woff2", "/manifest.webmanifest"]);

const req = (url: string, init: { method?: string; mode?: string } = {}) => ({ url, method: init.method ?? "GET", mode: init.mode ?? "cors" });
const nav = (path: string) => req(`${ORIGIN}${path}`, { mode: "navigate" });
const strategy = (r: ReturnType<typeof req>) => strategyFor(r, ORIGIN, PRECACHED);

describe("estrategia del service worker por petición", () => {
  it("las rutas de la SPA (privadas y de pestañas) abren el shell precacheado", () => {
    for (const path of ["/explorar", "/explorar/filtros?prov=Todas", "/favoritos", "/cuenta", "/propietario", "/propietario/casas/123", "/propietario/publicar/1/3", "/admin", "/ayuda"]) {
      expect(strategy(nav(path)), path).toBe("shell");
    }
  });

  it("la ficha pública y la portada van a la red primero; robots, sitemap, purga y archivos nunca reciben el shell", () => {
    expect(strategy(nav("/casa/CT-1234"))).toBe("page");
    expect(strategy(nav("/"))).toBe("page");
    for (const path of ["/robots.txt", "/sitemap.xml", "/_purge/CT-1234", "/sw.js", "/logo-horizontal.png"]) expect(strategy(nav(path)), path).toBe("network");
  });

  it("los recursos precacheados salen de la caché; lo demás del mismo origen va a la red", () => {
    expect(strategy(req(`${ORIGIN}/assets/index-abc.js`))).toBe("precache");
    expect(strategy(req(`${ORIGIN}/fonts/outfit-latin.woff2`))).toBe("precache");
    expect(strategy(req(`${ORIGIN}/manifest.webmanifest`))).toBe("precache");
    expect(strategy(req(`${ORIGIN}/assets/otro-zzz.js`))).toBe("network");
    expect(strategy(req(`${ORIGIN}/robots.txt`))).toBe("network");
  });

  it("PostgREST, Auth, subidas y cualquier escritura nunca se cachean", () => {
    expect(strategy(req(`${SUPABASE}/rest/v1/listings_public?select=*`))).toBe("network");
    expect(strategy(req(`${SUPABASE}/auth/v1/user`))).toBe("network");
    expect(strategy(req(`${SUPABASE}/storage/v1/upload/resumable`))).toBe("network");
    expect(strategy(req(`${SUPABASE}/storage/v1/object/listings/a/b/800.jpg`, { method: "POST" }))).toBe("network");
    expect(strategy(req(`${SUPABASE}/storage/v1/object/public/listings/a/b/800.jpg`, { method: "POST" }))).toBe("network");
    expect(strategy(req(`${ORIGIN}/vitals`, { method: "POST" }))).toBe("network");
    expect(strategy(req(`${ORIGIN}/assets/index-abc.js`, { method: "HEAD" }))).toBe("network");
  });

  it("fotos públicas de Storage y teselas de OSM", () => {
    expect(strategy(req(`${SUPABASE}/storage/v1/object/public/listings/a/b/480.jpg`, { mode: "no-cors" }))).toBe("photo");
    expect(strategy(req("https://tile.openstreetmap.org/15/8970/15520.png", { mode: "no-cors" }))).toBe("tile");
    // Storage privado (con JWT) no se toca.
    expect(strategy(req(`${SUPABASE}/storage/v1/object/listings/a/b/480.jpg`))).toBe("network");
  });
});

describe("lista de precache del build", () => {
  it("el shell, JS/CSS con hash, fuentes, iconos y manifiesto; sin mapas de fuente, index.html ni ficheros de configuración", () => {
    const list = precacheList(
      ["assets/index-abc.js", "assets/index-abc.css", "assets/index-abc.js.map", "index.html", ".vite/manifest.json", "sw.js"],
      ["fonts/outfit-latin.woff2", "icons/icono-192.png", "manifest.webmanifest", "favicon.ico", "_headers", "logo-horizontal.png", ".DS_Store"],
    );
    expect(list).toEqual([
      "/",
      "/assets/index-abc.css",
      "/assets/index-abc.js",
      "/favicon.ico",
      "/fonts/outfit-latin.woff2",
      "/icons/icono-192.png",
      "/logo-horizontal.png",
      "/manifest.webmanifest",
    ]);
  });
});
