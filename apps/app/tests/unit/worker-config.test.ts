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
      name: "3bstays-refactor",
      routes: [{ pattern: "refactor.3bstays.com", custom_domain: true }],
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
    expect(wrangler.name).toBe("3bstays");
    expect(wrangler.vars).toEqual({ ENVIRONMENT: "local" });
    expect(wrangler.env.pruebas.routes).toEqual([{ pattern: "pruebas.3bstays.com", custom_domain: true }]);
    expect(wrangler.env.pruebas.name).toBeUndefined();
    expect(wrangler.env.pruebas.workers_dev).toBe(true);
    expect(wrangler.env.pruebas.preview_urls).toBe(true);
    expect(wrangler.env.production.routes).toEqual([{ pattern: "3bstays.com", custom_domain: true }]);
    expect(wrangler.env.production.name).toBeUndefined();
    expect(wrangler.env.production.workers_dev).toBe(false);
    expect(wrangler.env.production.preview_urls).toBe(false);
    expect(wrangler.env.production.vars).toEqual({ ENVIRONMENT: "production", LAUNCHED: "false" });
    for (const config of [wrangler, wrangler.env.pruebas, wrangler.env.production]) {
      expect(config.triggers).toEqual({ crons: ["17 * * * *", "17 */3 * * *"] });
      expect(config.vars.LISTING_CACHE).toBeUndefined();
    }
  });
});

describe("wrangler · límite de las balizas (historia #71)", () => {
  // Las vinculaciones no se heredan: sin ella en un entorno, el worker descarta todas las balizas.
  it("cada entorno desplegado declara BEACON_LIMITER con 120 por minuto, local uno muy alto, y cada uno su namespace", () => {
    const envs = { local: wrangler, ...wrangler.env } as Record<string, { ratelimits?: { name: string; namespace_id: string; simple: unknown }[] }>;
    const ids = new Set<string>();
    for (const [name, env] of Object.entries(envs)) {
      const limiter = env.ratelimits?.find((r) => r.name === "BEACON_LIMITER");
      // Local (pnpm dev y la suite e2e, todo desde 127.0.0.1) no debe recibir 429.
      expect(limiter?.simple, name).toEqual({ limit: name === "local" ? 100000 : 120, period: 60 });
      ids.add(limiter!.namespace_id);
    }
    expect(ids.size).toBe(Object.keys(envs).length);
  });
});
