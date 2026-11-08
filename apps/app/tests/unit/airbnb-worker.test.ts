import { describe, expect, it } from "vitest";
import { createFakeAirbnbService } from "../../src/data/fake/airbnb";
import { addDays } from "../../src/domain/calendar";
import { createApp, type Env } from "../../src/server/app";
import { runAirbnbImport } from "../../src/server/airbnb";
import { fakeHarness } from "./fake-harness";
import { calendarEvent, calendarFile, TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";

async function setup(download?: typeof fetch) {
  const h = fakeHarness();
  const l = await h.seed({ status: "active" });
  const service = createFakeAirbnbService(h.db);
  const start = addDays(h.db.today(), 10);
  const end = addDays(h.db.today(), 13);
  const file = calendarFile(calendarEvent("prueba-worker", start.replaceAll("-", ""), end.replaceAll("-", ""), ["DESCRIPTION:privado-inventado"]));
  let reads = 0;
  const fetcher: typeof fetch = async (input, init) => { reads++; return download ? download(input, init) : new Response(file); };
  const app = createApp({ listings: () => h.anon, cache: () => null, purgeFetch: async () => Response.json({ success: true }), airbnb: { service: () => service, fetch: fetcher } });
  const env: Env = { ENVIRONMENT: "pruebas", SUPABASE_URL: "http://supabase.test", SUPABASE_ANON_KEY: "anon", ASSETS: { fetch: async () => new Response("shell") } };
  const requestId = crypto.randomUUID();
  const body = { listingId: l.id, requestId, url: TEST_AIRBNB_URL };
  const post = async (jwt?: string, origin = "https://app.test") => app.request("https://app.test/api/calendarios/airbnb", { method: "POST", headers: { authorization: `Bearer ${jwt ?? await h.jwt("owner")}`, origin, "content-type": "application/json" }, body: JSON.stringify(body) }, env);
  return { h, l, service, post, requestId, reads: () => reads, start, end };
}

describe("Airbnb · primera conexión HTTP", () => {
  it("rechaza sesión ausente o ajena antes de leer la URL externa", async () => {
    const t = await setup();
    expect((await t.post("")).status).toBe(401);
    expect((await t.post(await t.h.jwt("other"))).status).toBe(409);
    expect(t.reads()).toBe(0);
  });
  it("rechaza otro origen sin provocar descarga", async () => {
    const t = await setup();
    expect((await t.post(await t.h.jwt("owner"), "https://otro.test")).status).toBe(403);
    expect(t.reads()).toBe(0);
  });
  it("conecta sin devolver URL, token, UID ni descripción privada", async () => {
    const t = await setup();
    const response = await t.post();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ connected: true, state: "connected", nights: 3 });
    for (const secret of [TEST_AIRBNB_URL, "?t=", "prueba-worker", "privado-inventado"]) expect(text).not.toContain(secret);
  });
  it("el reintento de la misma petición no duplica descargas ni cambia el resultado", async () => {
    const t = await setup();
    const first = await (await t.post()).json();
    expect(await (await t.post()).json()).toEqual(first);
    expect(t.reads()).toBe(1);
  });
  it("HTML o un archivo incompleto no crean una conexión activa", async () => {
    const t = await setup(async () => new Response("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
    const response = await t.post();
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ code: "calendar" });
    expect(await t.service.overview(await t.h.jwt("owner"), t.l.id)).toMatchObject({ connected: false, lastSuccessAt: null, nights: 0 });
  });
  it("el motor reutilizado retira cancelaciones sin quitar el manual", async () => {
    const t = await setup();
    await t.h.calendar("owner").save(t.l.id, { days: [t.start], available: false, priceCrc: 75000 });
    await t.post();
    const request = crypto.randomUUID();
    await t.service.claim(t.l.id, request);
    await runAirbnbImport(t.service, t.l.id, request, { fetch: async () => new Response(calendarFile()) });
    expect(await t.h.calendar("owner").days(t.l.id)).toEqual([{ day: t.start, available: false, specialPriceCrc: 75000 }]);
  });
  it("una lectura que termina después de un bloqueo administrativo no publica sus noches", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const t = await setup(async () => { await gate; return new Response(calendarFile(calendarEvent("a", "20261210", "20261213"))); });
    const jwt = await t.h.jwt("owner");
    await t.service.begin(jwt, t.l.id, TEST_AIRBNB_URL, t.requestId);
    const running = runAirbnbImport(t.service, t.l.id, t.requestId, { fetch: async () => { await gate; return new Response(calendarFile(calendarEvent("a", "20261210", "20261213"))); } });
    await t.h.admin("aal2").blockListing(t.l.id, "Bloqueo de prueba");
    release();
    await running;
    expect(await t.service.overview(jwt, t.l.id)).toMatchObject({ connected: false, state: "suspended", nights: 0 });
  });
});
