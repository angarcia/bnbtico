import { describe, expect, it } from "vitest";
import { createFakeAirbnbService } from "../../src/data/fake/airbnb";
import { addDays } from "../../src/domain/calendar";
import { createApp, type Env } from "../../src/server/app";
import { calendarEvent, calendarFile, TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";
import { fakeHarness } from "./fake-harness";

const REPLACEMENT_URL = "https://www.airbnb.com/calendar/ical/987654321.ics?t=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

async function connected(download: typeof fetch) {
  const h = fakeHarness();
  const l = await h.seed({ status: "active" });
  const service = createFakeAirbnbService(h.db);
  const jwt = await h.jwt("owner");
  const start = addDays(h.db.today(), 10);
  const initial = crypto.randomUUID();
  await service.begin(jwt, l.id, TEST_AIRBNB_URL, initial);
  await service.context(l.id, initial);
  await service.finish(l.id, initial, [{ uid: "primera-lectura", start, end: addDays(start, 2) }], null);
  const previous = await service.overview(jwt, l.id);
  let reads = 0;
  const app = createApp({ listings: () => h.anon, cache: () => null,
    purgeFetch: async () => Response.json({ success: true }),
    airbnb: { service: () => service, fetch: async (input, init) => { reads++; return download(input, init); } },
  });
  const env: Env = { ENVIRONMENT: "pruebas", SUPABASE_URL: "http://supabase.test", SUPABASE_ANON_KEY: "anon", ASSETS: { fetch: async () => new Response("shell") } };
  const post = (action: "refresh" | "replace", requestId: string, url?: string, token = jwt) => app.request("https://app.test/api/calendarios/airbnb", {
    method: "POST", headers: { authorization: `Bearer ${token}`, origin: "https://app.test", "content-type": "application/json" },
    body: JSON.stringify({ listingId: l.id, requestId, action, ...(url ? { url } : {}) }),
  }, env);
  return { h, l, service, jwt, start, previous, post, reads: () => reads };
}

describe("Airbnb · gestión HTTP del propietario", () => {
  it("actualiza una conexión con el mismo motor sin pedir de nuevo su URL privada", async () => {
    const t = await connected(async () => new Response(calendarFile(calendarEvent("nueva-lectura", "20261210", "20261213"))));
    const request = crypto.randomUUID();
    const first = await t.post("refresh", request);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ connected: true, state: "connected", nights: 3 });
    const repeated = await t.post("refresh", request);
    expect(repeated.status).toBe(200);
    expect(t.reads()).toBe(1);
  });

  it("un sustituto ilegible conserva enlace, noches y fecha del último éxito", async () => {
    const t = await connected(async () => new Response("<html>No es un calendario</html>"));
    const response = await t.post("replace", crypto.randomUUID(), REPLACEMENT_URL);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "calendar" });
    const summary = await t.service.overview(t.jwt, t.l.id);
    expect(summary).toMatchObject({ connected: true, state: "error", nights: 2, lastSuccessAt: t.previous.lastSuccessAt });
    const check = crypto.randomUUID();
    await t.service.claim(t.l.id, check);
    expect(await t.service.context(t.l.id, check)).toEqual({ url: TEST_AIRBNB_URL });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain(TEST_AIRBNB_URL);
    expect(serialized).not.toContain(REPLACEMENT_URL);
  });

  it("dos pulsaciones y otra pestaña no producen dos lecturas simultáneas", async () => {
    let release: () => void = () => {};
    let started: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reading = new Promise<void>(resolve => { started = resolve; });
    const t = await connected(async () => { started(); await gate; return new Response(calendarFile()); });
    const request = crypto.randomUUID();
    const first = t.post("refresh", request);
    try {
      await reading;
      const same = await t.post("refresh", request);
      expect(same.status).toBe(200);
      expect(await same.json()).toMatchObject({ state: "running", connected: true, nights: 2 });
      expect((await t.post("refresh", crypto.randomUUID())).status).toBe(409);
      expect(t.reads()).toBe(1);
    } finally { release(); }
    expect((await first).status).toBe(200);
  });

  it("sesión ausente o ajena no dispara una actualización externa", async () => {
    const t = await connected(async () => new Response(calendarFile()));
    expect((await t.post("refresh", crypto.randomUUID(), undefined, "")).status).toBe(401);
    expect((await t.post("refresh", crypto.randomUUID(), undefined, await t.h.jwt("other"))).status).toBe(409);
    expect(t.reads()).toBe(0);
  });
});
