import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const wrangler = JSON.parse(
  readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n"),
);

describe("wrangler · worker aislado del refactor", () => {
  it("envía la importación de Airbnb al worker antes que a los assets de la SPA", () => {
    expect(wrangler.assets.run_worker_first).toContain("/api/calendarios/*");
    expect(wrangler.env.pruebas.assets).toBeUndefined();
    expect(wrangler.env.production.assets.run_worker_first).toBe(true);
  });

  it("envía el feed iCal al worker y conserva logs explícitos sin registrar la URL de invocación", () => {
    expect(wrangler.assets.run_worker_first).toContain("/ical/*");
    expect(wrangler.observability).toMatchObject({ enabled: true, logs: { enabled: true, invocation_logs: false } });
    expect(wrangler.env.pruebas.assets).toBeUndefined();
    expect(wrangler.env.production.assets.run_worker_first).toBe(true);
  });

  it("solo publica en su dominio y desactiva workers.dev y URLs de preview", () => {
    expect(wrangler.env.refactor).toMatchObject({
      name: "bnbtico-refactor",
      routes: [{ pattern: "refactor.bnbtico.com", custom_domain: true }],
      workers_dev: false,
      preview_urls: false,
      version_metadata: { binding: "CF_VERSION_METADATA" },
    });
    expect(wrangler.env.refactor.routes).toHaveLength(1);
  });

  it("no configura cron ni integraciones y solo desactiva caché de fichas", () => {
    expect(wrangler.env.refactor?.triggers).toEqual({ crons: [] });
    expect(wrangler.env.refactor?.vars).toEqual({
      ENVIRONMENT: "pruebas",
      SUPABASE_URL: "https://bpxiggdzgzolcazaaboj.supabase.co",
      LISTING_CACHE: "no-store",
    });
    expect(wrangler.env.refactor.assets).toBeUndefined();
    expect(wrangler.assets.run_worker_first).toContain("/casa/*");
  });

  it("mantiene los destinos, cron y caché de los entornos actuales", () => {
    expect(wrangler.name).toBe("bnbtico");
    expect(wrangler.vars).toEqual({ ENVIRONMENT: "local" });
    expect(wrangler.env.pruebas.routes).toEqual([{ pattern: "nueva.bnbtico.com", custom_domain: true }]);
    expect(wrangler.env.pruebas.name).toBeUndefined();
    expect(wrangler.env.pruebas.workers_dev).toBe(true);
    expect(wrangler.env.pruebas.preview_urls).toBe(true);
    expect(wrangler.env.production.routes).toBeUndefined();
    expect(wrangler.env.production.name).toBeUndefined();
    expect(wrangler.env.production.workers_dev).toBe(false);
    expect(wrangler.env.production.preview_urls).toBe(false);
    expect(wrangler.env.production.vars).toEqual({ ENVIRONMENT: "production", LAUNCHED: "false" });
    for (const config of [wrangler, wrangler.env.pruebas, wrangler.env.production]) {
      expect(config.triggers).toEqual({ crons: ["17 * * * *"] });
      expect(config.vars.LISTING_CACHE).toBeUndefined();
    }
  });
});
