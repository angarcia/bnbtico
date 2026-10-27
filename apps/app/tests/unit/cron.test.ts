// Cron diario del worker: mantiene despierto el proyecto gratuito de Supabase y recorta la telemetría vieja.
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/server/app";
import { runDaily, TELEMETRY_RETENTION_DAYS } from "../../src/server/cron";
import { createFxWriter } from "../../src/data/postgrest/fx";
import { FX_SOURCES, type FxRate } from "../../src/domain/fx";

const env = { ENVIRONMENT: "pruebas", SUPABASE_URL: "https://proyecto.supabase.co", SUPABASE_ANON_KEY: "anon" } as Env;
const NOW = Date.parse("2026-10-23T09:17:00Z");

function deps(response: () => Promise<Response>) {
  const lines: string[] = [];
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => response());
  const prune = vi.fn(async (_before: string) => 3);
  let t = NOW;
  return { lines, fetch, prune, d: { fetch: fetch as unknown as typeof globalThis.fetch, log: (l: string) => lines.push(l), now: () => (t += 42) - 42, telemetry: { prune } } };
}

describe("cron diario", () => {
  it("pide una fila pública a PostgREST con la anon key y deja una línea de log estructurada", async () => {
    const x = deps(async () => Response.json([{ public_id: "CT-1015" }]));
    await runDaily(env, x.d, "17 9 * * *");
    expect(x.fetch).toHaveBeenCalledWith("https://proyecto.supabase.co/rest/v1/listings_public?select=public_id&limit=1", expect.objectContaining({ headers: expect.objectContaining({ apikey: "anon" }) }));
    const line = JSON.parse(x.lines[0]!);
    expect(line).toEqual({ event: "keepalive", ok: true, status: 200, ms: 42, cron: "17 9 * * *", environment: "pruebas", pruned: 3 });
  });

  it(`recorta la telemetría de más de ${TELEMETRY_RETENTION_DAYS} días`, async () => {
    const x = deps(async () => Response.json([]));
    await runDaily(env, x.d, "17 9 * * *");
    expect(x.prune).toHaveBeenCalledWith(new Date(NOW - TELEMETRY_RETENTION_DAYS * 86_400_000).toISOString());
  });

  it("si PostgREST falla, lo registra y el cron falla (se ve en el panel de Cloudflare)", async () => {
    const x = deps(async () => new Response("caído", { status: 503 }));
    await expect(runDaily(env, x.d, "17 9 * * *")).rejects.toThrow(/503/);
    expect(JSON.parse(x.lines[0]!)).toMatchObject({ event: "keepalive", ok: false, status: 503 });
  });

  it("si no hay red, también", async () => {
    const x = deps(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(runDaily(env, x.d, "17 9 * * *")).rejects.toThrow();
    expect(JSON.parse(x.lines[0]!)).toMatchObject({ event: "keepalive", ok: false, status: 0, error: "TypeError: fetch failed" });
  });

  it("sin escritor de telemetría (sin clave de servicio) solo hace el keep-alive", async () => {
    const x = deps(async () => Response.json([]));
    await runDaily(env, { ...x.d, telemetry: null }, "17 9 * * *");
    expect(JSON.parse(x.lines[0]!)).toMatchObject({ ok: true, pruned: null });
  });

  it("en producción antes del lanzamiento (aún sin Supabase) no consulta nada y no falla", async () => {
    const x = deps(async () => Response.json([]));
    await runDaily({ ENVIRONMENT: "production" } as Env, x.d, "17 9 * * *");
    expect(x.fetch).not.toHaveBeenCalled();
    expect(x.prune).not.toHaveBeenCalled();
    expect(JSON.parse(x.lines[0]!)).toEqual({ event: "keepalive", skipped: "solo portada", cron: "17 9 * * *", environment: "production" });
  });

  it("en producción lanzada hace el keep-alive", async () => {
    const x = deps(async () => Response.json([]));
    await runDaily({ ...env, ENVIRONMENT: "production", LAUNCHED: "true" } as Env, x.d, "17 9 * * *");
    expect(x.fetch).toHaveBeenCalledOnce();
  });

  describe("tipo de cambio (ticket 21)", () => {
    const [jsdelivr, pages, er] = FX_SOURCES.map((s) => s.url) as [string, string, string];
    const KEEPALIVE = "https://proyecto.supabase.co/rest/v1/listings_public?select=public_id&limit=1";
    function fxDeps(byUrl: Record<string, () => Response>) {
      const lines: string[] = [];
      const saved: FxRate[] = [];
      const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
        const r = byUrl[url];
        if (!r) throw new TypeError("fetch failed");
        return r();
      });
      return {
        lines,
        saved,
        fetch,
        d: { fetch: fetch as unknown as typeof globalThis.fetch, log: (l: string) => lines.push(l), now: () => NOW, telemetry: null, fx: { save: async (r: FxRate) => void saved.push(r) } },
      };
    }
    const fxLine = (lines: string[]) => lines.map((l) => JSON.parse(l)).find((l) => l.event === "fx");

    it("guarda el tipo de la principal con su fecha y fuente, y lo registra", async () => {
      const x = fxDeps({ [KEEPALIVE]: () => Response.json([]), [jsdelivr]: () => Response.json({ date: "2026-10-26", usd: { crc: 455.07 } }) });
      await runDaily(env, x.d, "17 9 * * *");
      expect(x.saved).toEqual([{ crcPerUsd: 455.07, day: "2026-10-26", source: "fawazahmed0" }]);
      expect(fxLine(x.lines)).toEqual({ event: "fx", ok: true, crcPerUsd: 455.07, day: "2026-10-26", source: "fawazahmed0", failures: [] });
    });

    it("con la principal caída, el respaldo", async () => {
      const x = fxDeps({
        [KEEPALIVE]: () => Response.json([]),
        [jsdelivr]: () => new Response("", { status: 500 }),
        [pages]: () => new Response("", { status: 500 }),
        [er]: () => Response.json({ result: "success", base_code: "USD", time_last_update_unix: Date.parse("2026-10-26T00:02:31Z") / 1000, rates: { CRC: 455.6 } }),
      });
      await runDaily(env, x.d, "17 9 * * *");
      expect(x.saved).toEqual([{ crcPerUsd: 455.6, day: "2026-10-26", source: "exchangerate-api" }]);
      expect(fxLine(x.lines)).toMatchObject({ ok: true, source: "exchangerate-api", failures: [`${jsdelivr}: HTTP 500`, `${pages}: HTTP 500`] });
    });

    it("si fallan las dos, no escribe nada (queda el último), lo registra y el cron no falla por eso", async () => {
      const x = fxDeps({ [KEEPALIVE]: () => Response.json([]) });
      await runDaily(env, x.d, "17 9 * * *");
      expect(x.saved).toEqual([]);
      expect(fxLine(x.lines)).toMatchObject({ event: "fx", ok: false, kept: "último guardado" });
    });

    it("si falla el guardado, lo registra sin tumbar el keep-alive", async () => {
      const x = fxDeps({ [KEEPALIVE]: () => Response.json([]), [jsdelivr]: () => Response.json({ date: "2026-10-26", usd: { crc: 455 } }) });
      await runDaily(env, { ...x.d, fx: { save: async () => Promise.reject(new Error("PostgREST 401")) } }, "17 9 * * *");
      expect(fxLine(x.lines)).toMatchObject({ ok: false, error: "Error: PostgREST 401" });
    });

    it("sin clave de servicio (fx null) no pide el tipo a nadie", async () => {
      const x = fxDeps({ [KEEPALIVE]: () => Response.json([]) });
      await runDaily(env, { ...x.d, fx: null }, "17 9 * * *");
      expect(x.fetch).toHaveBeenCalledOnce();
      expect(fxLine(x.lines)).toBeUndefined();
    });

    it("en «solo portada» tampoco", async () => {
      const x = fxDeps({});
      await runDaily({ ENVIRONMENT: "production" } as Env, x.d, "17 9 * * *");
      expect(x.fetch).not.toHaveBeenCalled();
    });

    it("el escritor hace un upsert por día en fx_rates con la service role", async () => {
      const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 201 }));
      await createFxWriter("https://proyecto.supabase.co", "service", fetch as unknown as typeof globalThis.fetch).save({ crcPerUsd: 455.07, day: "2026-10-26", source: "fawazahmed0" });
      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe("https://proyecto.supabase.co/rest/v1/fx_rates?on_conflict=day");
      expect(init).toMatchObject({ method: "POST", headers: expect.objectContaining({ apikey: "service", authorization: "Bearer service", prefer: "resolution=merge-duplicates,return=minimal" }) });
      expect(JSON.parse(String(init!.body))).toEqual({ day: "2026-10-26", crc_per_usd: 455.07, source: "fawazahmed0" });
    });

    it("el escritor falla si PostgREST responde error", async () => {
      const fetch = vi.fn(async () => new Response("no", { status: 401 }));
      await expect(createFxWriter("https://p.supabase.co", "x", fetch as unknown as typeof globalThis.fetch).save({ crcPerUsd: 455, day: "2026-10-26", source: "fawazahmed0" })).rejects.toThrow(/401/);
    });
  });
});
