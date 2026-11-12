import { beforeAll, describe, expect, it } from "vitest";
import { createAirbnbService } from "../../src/data/postgrest/airbnb";
import { addDays } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
import { AIRBNB_CRON, runAirbnbCycle } from "../../src/server/airbnb-cycle";
import { TEST_AIRBNB_URL, calendarFile } from "../fixtures/airbnb-ical";
import { localSupabase } from "./local";
import { postgrestHarness } from "./postgrest-harness";

const first = "2026-11-12T09:17:00.000Z";
const next = "2026-11-12T12:17:00.000Z";
const third = "2026-11-12T15:17:00.000Z";

describe("Airbnb automático contra PostgREST local", () => {
  let h: Awaited<ReturnType<typeof postgrestHarness>>;
  beforeAll(async () => { h = await postgrestHarness(); await h.reset(); }, 90_000);

  it("conserva el éxito al fallar, reintenta en el próximo ciclo y descarta resultados tras desconectar", async () => {
    const l = await h.seed({ status: "active" });
    const jwt = await h.jwt("owner");
    const local = localSupabase();
    const service = createAirbnbService({ ...local, supabaseUrl: local.url, fetch: (input, init) => fetch(input, init) });
    const request = crypto.randomUUID();
    await service.begin(jwt, l.id, TEST_AIRBNB_URL, request);
    await service.context(l.id, request);
    const today = costaRicaToday(Date.now());
    const blocks = [{ uid: "automatica", start: addDays(today, 1), end: addDays(today, 3) }];
    await service.finish(l.id, request, blocks, null);
    const initial = await service.overview(jwt, l.id);
    let reads = 0;
    const simulate = (cycle: string, valid: boolean) => runAirbnbCycle({
      ...service,
      // Solo la casa sintética se importa. Las demás conexiones locales quedan fuera.
      due: async (time) => (await service.due(time)).filter(id => id === l.id),
    }, {
      now: () => Date.parse(cycle), log: () => {},
      fetch: async () => { reads++; return valid ? new Response(calendarFile()) : new Response(null, { status: 503 }); },
    }, AIRBNB_CRON, Date.parse(cycle));

    await simulate(first, false);
    expect(await service.overview(jwt, l.id)).toMatchObject({ nights: 2, lastSuccessAt: initial.lastSuccessAt, errorCode: "download" });
    await simulate(first, true);
    expect(reads).toBe(1);
    await simulate(next, true);
    expect(reads).toBe(2);
    expect(await service.overview(jwt, l.id)).toMatchObject({ nights: 0, errorCode: null });

    const manual = crypto.randomUUID();
    await service.update(jwt, l.id, manual);
    expect(await service.claimCycle(l.id, crypto.randomUUID(), third)).toEqual({ run: false });
    await service.context(l.id, manual);
    await service.finish(l.id, manual, [], null);
    expect(await service.claimCycle(l.id, crypto.randomUUID(), third)).toEqual({ run: false });

    const fourth = "2026-11-12T18:17:00.000Z";
    const automatic = crypto.randomUUID();
    const competing = crypto.randomUUID();
    const results = await Promise.all([service.claimCycle(l.id, automatic, fourth), service.claimCycle(l.id, competing, fourth)]);
    expect(results.filter(r => r.run)).toHaveLength(1);
    const claimed = results[0].run ? automatic : competing;
    expect(await service.context(l.id, claimed)).not.toBeNull();
    await service.disconnect(jwt, l.id, crypto.randomUUID());
    await service.finish(l.id, claimed, blocks, null);
    expect(await service.overview(jwt, l.id)).toMatchObject({ connected: false, nights: 0, lastSuccessAt: null });
    expect(await service.due("2026-11-12T21:17:00.000Z")).not.toContain(l.id);
  });
});
