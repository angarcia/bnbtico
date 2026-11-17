// Migración airbnb_intervalo (2026-11-17): el ciclo automático ya no es solo «cada 3 horas en el minuto 17». La base
// acepta cualquier ciclo en minuto exacto (múltiplo de 5, o el 17 de los intervalos de horas) y nunca lee una casa dos
// veces en menos de 5 minutos, aunque el worker se equivoque.
import { beforeAll, describe, expect, it } from "vitest";
import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";
import { localSupabase } from "./local";
import { postgrestHarness } from "./postgrest-harness";

describe("ciclos de Airbnb con cualquier intervalo", () => {
  let h: Awaited<ReturnType<typeof postgrestHarness>>;
  let service: ReturnType<typeof createAirbnbService>;
  beforeAll(async () => {
    h = await postgrestHarness();
    const local = localSupabase();
    service = createAirbnbService({ ...local, supabaseUrl: local.url, fetch: (input, init) => fetch(input, init) });
  }, 90_000);

  async function connected() {
    await h.reset();
    const l = await h.seed({ status: "active" });
    const request = crypto.randomUUID();
    await service.begin(await h.jwt("owner"), l.id, TEST_AIRBNB_URL, request);
    await service.context(l.id, request);
    await service.finish(l.id, request, [], null);
    return l.id;
  }
  /** Reclama el ciclo y, si toca leer, cierra la lectura para que la siguiente no choque con una en curso. */
  async function claim(id: string, cycle: string) {
    const request = crypto.randomUUID();
    const result = await service.claimCycle(id, request, cycle);
    if (result.run) {
      await service.context(id, request); // como el worker: pide el enlace y después cierra la lectura
      await service.finish(id, request, [], null);
    }
    return result.run;
  }

  it("vale cualquier múltiplo de 5 minutos y el minuto 17; no otro minuto ni con segundos", async () => {
    const id = await connected();
    expect(await claim(id, "2026-11-12T09:05:00.000Z")).toBe(true);
    expect(await claim(id, "2026-11-12T09:10:00.000Z")).toBe(true);
    expect(await claim(id, "2026-11-12T10:17:00.000Z")).toBe(true);
    for (const bad of ["2026-11-12T11:07:00.000Z", "2026-11-12T11:05:30.000Z"]) {
      await expect(service.claimCycle(id, crypto.randomUUID(), bad)).rejects.toThrow();
    }
  });

  it("no lee una casa dos veces en menos de 5 minutos, ni la ofrece entre las pendientes", async () => {
    const id = await connected();
    expect(await claim(id, "2026-11-12T09:15:00.000Z")).toBe(true);
    expect(await service.due("2026-11-12T09:17:00.000Z")).not.toContain(id);
    expect(await claim(id, "2026-11-12T09:17:00.000Z")).toBe(false);
    expect(await claim(id, "2026-11-12T09:15:00.000Z")).toBe(false);
    expect(await service.due("2026-11-12T09:20:00.000Z")).toContain(id);
    expect(await claim(id, "2026-11-12T09:20:00.000Z")).toBe(true);
  });
});
