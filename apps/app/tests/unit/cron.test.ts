// Cron diario del worker: mantiene despierto el proyecto gratuito de Supabase y recorta la telemetría vieja.
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/server/app";
import { runDaily, TELEMETRY_RETENTION_DAYS } from "../../src/server/cron";

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
});
