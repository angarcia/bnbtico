// Migración airbnb_limites_ajustables (2026-11-17): la espera y el tope de las lecturas manuales de Airbnb salen de
// airbnb_settings, que escribe el despliegue (variables de GitHub) con set_airbnb_manual_limits. Solo el servicio la
// escribe; nadie la lee por REST; los valores fuera de rango se rechazan.
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";
import { anonClient, localSupabase, serviceClient, signIn, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

describe("límites manuales de Airbnb ajustables", () => {
  let h: Awaited<ReturnType<typeof postgrestHarness>>;
  let service: ReturnType<typeof createAirbnbService>;
  beforeAll(async () => {
    h = await postgrestHarness();
    const local = localSupabase();
    service = createAirbnbService({ ...local, supabaseUrl: local.url, fetch: (input, init) => fetch(input, init) });
  }, 90_000);
  afterEach(async () => {
    await serviceClient().rpc("set_airbnb_manual_limits", { p_wait_minutes: 15, p_per_day: 10 });
  });

  async function connected() {
    await h.reset();
    const l = await h.seed({ status: "active" });
    const request = crypto.randomUUID();
    await service.begin(await h.jwt("owner"), l.id, TEST_AIRBNB_URL, request);
    await service.context(l.id, request);
    await service.finish(l.id, request, [], null);
    return l.id;
  }

  it("con 2 minutos y 1 al día: la espera y el tope cambian, y el resumen y el mensaje dicen la cifra", async () => {
    expect((await serviceClient().rpc("set_airbnb_manual_limits", { p_wait_minutes: 2, p_per_day: 1 })).error).toBeNull();
    const id = await connected();
    const jwt = await h.jwt("owner");
    const summary = await service.overview(jwt, id);
    expect(summary).toMatchObject({ manualLeftToday: 0, manualPerDay: 1 });
    expect(Date.parse(summary.manualAvailableAt!) - Date.now()).toBeLessThanOrEqual(2 * 60_000);
    await h.ageAirbnbReads(id, 3 * 60_000);
    await expect(service.update(jwt, id, crypto.randomUUID())).rejects.toThrow("Hoy ya actualizó 1 vez. Podrá actualizar de nuevo mañana.");
  });

  it("solo el servicio cambia los límites; nadie los lee por REST; fuera de rango se rechaza", async () => {
    const owner = await signIn("owner");
    for (const client of [anonClient(), owner]) {
      expect((await client.rpc("set_airbnb_manual_limits", { p_wait_minutes: 1, p_per_day: 50 })).error).not.toBeNull();
      expect((await client.from("airbnb_settings").select("*")).data ?? []).toEqual([]);
    }
    for (const [wait, perDay] of [[0, 10], [61, 10], [15, 0], [15, 51]]) {
      expect((await serviceClient().rpc("set_airbnb_manual_limits", { p_wait_minutes: wait!, p_per_day: perDay! })).error, `${wait}/${perDay}`).not.toBeNull();
    }
    expect(sql("select manual_wait_minutes || '/' || manual_per_day from public.airbnb_settings;")).toBe("15/10");
  });
});
