// Catálogo de componentes (estructura del frontend, paso 5): /_componentes existe en local y en pruebas, y en producción es
// 404 aunque la app esté lanzada; el service worker no lo sirve desde su caché, así que una app instalada tampoco lo abre.
import { describe, expect, it, vi } from "vitest";
import { createApp, type Env } from "../../src/server/app";
import { strategyFor } from "../../src/sw/routes";
import { fakeHarness } from "./fake-harness";

const SHELL = "<!doctype html><title>shell</title>";

function setup(over: Partial<Env> = {}) {
  // /portada es portada.html (el 404 de producción antes del lanzamiento); lo demás, el shell.
  const assets = vi.fn(async (input: Request | URL | string) =>
    new Response(new URL(input instanceof Request ? input.url : input).pathname === "/portada" ? "portada" : SHELL, { headers: { "content-type": "text/html" } }));
  const app = createApp({ listings: () => fakeHarness().anon, cache: () => null, purgeFetch: fetch });
  const env: Env = { ENVIRONMENT: "pruebas", SUPABASE_URL: "http://supabase.test", SUPABASE_ANON_KEY: "anon", ASSETS: { fetch: assets }, ...over };
  return { assets, request: (path: string) => app.request(`https://3bstays.test${path}`, undefined, env) };
}

describe("/_componentes", () => {
  it("en pruebas y en local es el shell de la SPA", async () => {
    for (const ENVIRONMENT of ["pruebas", "local"] as const) {
      const t = setup({ ENVIRONMENT });
      const res = await t.request("/_componentes");
      expect(res.status, ENVIRONMENT).toBe(200);
      expect(await res.text()).toBe(SHELL);
    }
  });

  it("en producción responde 404, también con la app lanzada, sin servir el shell", async () => {
    for (const LAUNCHED of ["true", "false"]) {
      const t = setup({ ENVIRONMENT: "production", LAUNCHED });
      const res = await t.request("/_componentes");
      expect(res.status, `LAUNCHED=${LAUNCHED}`).toBe(404);
      // Antes del lanzamiento, el 404 de producción lleva la portada; nunca el shell de la SPA.
      expect(await res.text()).not.toBe(SHELL);
    }
  });

  it("el service worker lo manda siempre a la red (nunca el shell de su caché)", () => {
    const nav = { method: "GET", mode: "navigate", url: "https://3bstays.test/_componentes" };
    expect(strategyFor(nav, "https://3bstays.test", new Set())).toBe("network");
  });
});
