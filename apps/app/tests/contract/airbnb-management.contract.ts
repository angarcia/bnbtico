import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AirbnbService } from "../../src/domain/airbnb";
import { addDays } from "../../src/domain/calendar";
import type { IcalExportService } from "../../src/domain/ical-export";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { SubscriptionHarness } from "./harness";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";

export const REPLACEMENT_URL = "https://www.airbnb.com/calendar/ical/987654321.ics?t=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

export function airbnbManagementContract(name: string, make: () => Promise<{ h: SubscriptionHarness; service: AirbnbService; exports: IcalExportService }>) {
  describe(`Gestión Airbnb · ${name}`, () => {
    let h: SubscriptionHarness;
    let s: AirbnbService;
    let exports: IcalExportService;
    const day = (n: number) => addDays(costaRicaToday(Date.now()), n);
    beforeAll(async () => { ({ h, service: s, exports } = await make()); }, 90_000);
    beforeEach(async () => h.reset(), 60_000);
    afterAll(async () => { if (h) await h.reset(); }, 60_000);
    async function connect(id: string) {
      const jwt = await h.jwt("owner");
      const request = crypto.randomUUID();
      await s.begin(jwt, id, TEST_AIRBNB_URL, request);
      await s.context(id, request);
      await s.finish(id, request, [{ uid: "reserva-anterior", start: day(10), end: day(13) }], null);
      return jwt;
    }
    async function currentUrl(id: string) {
      const request = crypto.randomUUID();
      await s.claim(id, request);
      const context = await s.context(id, request);
      await s.finish(id, request, null, "download");
      return context?.url;
    }

    it("solo el propietario habilitado actualiza, sustituye o desconecta", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      for (const token of ["", await h.jwt("other")]) {
        await expect(s.update(token, l.id, crypto.randomUUID())).rejects.toThrow();
        await expect(s.update(token, l.id, crypto.randomUUID(), REPLACEMENT_URL)).rejects.toThrow();
        await expect(s.disconnect(token, l.id, crypto.randomUUID())).rejects.toThrow();
      }
      await h.setAccountActive("owner", false);
      try {
        await expect(s.update(jwt, l.id, crypto.randomUUID())).rejects.toThrow();
        await expect(s.disconnect(jwt, l.id, crypto.randomUUID())).rejects.toThrow();
      } finally { await h.setAccountActive("owner", true); }
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 3 });
    });

    it("una sola actualización ocupa la conexión, incluso con otro requestId o modo", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      const request = crypto.randomUUID();
      const results = await Promise.allSettled([s.update(jwt, l.id, request), s.update(jwt, l.id, crypto.randomUUID())]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
      await expect(s.update(jwt, l.id, crypto.randomUUID(), REPLACEMENT_URL)).rejects.toThrow();
      expect(await s.overview(jwt, l.id)).toMatchObject({ state: "running", nights: 3 });
    });

    it("repetir la misma actualización no descarga ni aplica dos veces", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      const request = crypto.randomUUID();
      expect(await s.update(jwt, l.id, request)).toEqual({ run: true });
      expect(await s.update(jwt, l.id, request)).toEqual({ run: false });
      expect(await s.context(l.id, request)).toEqual({ url: TEST_AIRBNB_URL });
      expect(await s.context(l.id, request)).toBeNull();
      await s.finish(l.id, request, [], null);
      const after = await s.overview(jwt, l.id);
      expect(await s.update(jwt, l.id, request)).toEqual({ run: false });
      await s.finish(l.id, request, [{ uid: "tardío", start: day(20), end: day(23) }], null);
      expect(await s.overview(jwt, l.id)).toEqual(after);
    });

    it("fallar conserva las noches y la fecha correcta, pero registra fecha de error propia", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      const before = await s.overview(jwt, l.id);
      const request = crypto.randomUUID();
      await s.update(jwt, l.id, request);
      await s.context(l.id, request);
      await s.finish(l.id, request, null, "timeout");
      const failed = await s.overview(jwt, l.id);
      expect(failed).toMatchObject({ connected: true, state: "error", errorCode: "timeout", nights: 3, lastSuccessAt: before.lastSuccessAt });
      expect(typeof failed.lastErrorAt).toBe("string");
      expect(Date.parse(failed.lastErrorAt!)).toBeGreaterThanOrEqual(Date.parse(before.lastSuccessAt!));
      const retry = crypto.randomUUID();
      await s.update(jwt, l.id, retry);
      expect(await s.overview(jwt, l.id)).toMatchObject({ state: "running", lastErrorAt: failed.lastErrorAt, lastSuccessAt: before.lastSuccessAt });
      await s.context(l.id, retry);
      await s.finish(l.id, retry, [], null);
      expect(await s.overview(jwt, l.id)).toMatchObject({ state: "connected", errorCode: null, lastErrorAt: null, nights: 0 });
    });

    it("el sustituto fallido conserva la URL anterior; solo el válido cambia URL y noches", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      const before = await s.overview(jwt, l.id);
      const failed = crypto.randomUUID();
      await s.update(jwt, l.id, failed, REPLACEMENT_URL);
      expect(await s.context(l.id, failed)).toEqual({ url: REPLACEMENT_URL });
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 3, lastSuccessAt: before.lastSuccessAt });
      await s.finish(l.id, failed, null, "calendar");
      expect(await currentUrl(l.id)).toBe(TEST_AIRBNB_URL);
      const valid = crypto.randomUUID();
      await s.update(jwt, l.id, valid, REPLACEMENT_URL);
      await s.context(l.id, valid);
      await s.finish(l.id, valid, [{ uid: "sustituto", start: day(15), end: day(17) }], null);
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 2, errorCode: null });
      expect(await currentUrl(l.id)).toBe(REPLACEMENT_URL);
    });

    it("desconectar retira solo importados y mantiene manual, precio y exportación", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      await h.calendar("owner").save(l.id, { days: [day(11)], available: false, priceCrc: 75000 });
      const exported = await exports.owner(jwt, l.id, true);
      const request = crypto.randomUUID();
      await s.disconnect(jwt, l.id, request);
      await s.disconnect(jwt, l.id, request);
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: false, state: "none", nights: 0 });
      expect(await h.calendar("owner").days(l.id)).toEqual([{ day: day(11), available: false, specialPriceCrc: 75000 }]);
      expect(await exports.read(exported.token!)).toMatchObject({ nights: [day(11)] });
    });

    it("una lectura vieja no revive una desconexión ni modifica la reconexión posterior", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      const stale = crypto.randomUUID();
      await s.update(jwt, l.id, stale);
      await s.context(l.id, stale);
      const disconnect = crypto.randomUUID();
      await s.disconnect(jwt, l.id, disconnect);
      await s.finish(l.id, stale, [{ uid: "viejo", start: day(20), end: day(23) }], null);
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: false, nights: 0 });
      await connect(l.id);
      await s.disconnect(jwt, l.id, disconnect);
      await s.finish(l.id, stale, [], null);
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 3 });
      await expect(s.update(jwt, l.id, disconnect)).rejects.toThrow();
    });

    it("el resultado de una lectura antigua no pisa una sustitución correcta", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      const stale = crypto.randomUUID();
      await s.update(jwt, l.id, stale);
      await s.context(l.id, stale);
      await s.disconnect(jwt, l.id, crypto.randomUUID());
      const replacement = crypto.randomUUID();
      await s.begin(jwt, l.id, REPLACEMENT_URL, replacement);
      await s.context(l.id, replacement);
      await s.finish(l.id, replacement, [{ uid: "nuevo", start: day(18), end: day(19) }], null);
      await s.finish(l.id, stale, [], null);
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 1 });
      expect(await currentUrl(l.id)).toBe(REPLACEMENT_URL);
    });

    it("una revocación repetida no afecta a un enlace generado después", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await connect(l.id);
      const first = await exports.owner(jwt, l.id, true);
      expect(typeof first.generation).toBe("number");
      await exports.revoke(jwt, l.id, first.generation);
      await exports.revoke(jwt, l.id, first.generation);
      expect(await exports.read(first.token!)).toBeNull();
      const next = await exports.owner(jwt, l.id, true);
      expect(first.token === next.token).toBe(false);
      await expect(exports.revoke(jwt, l.id, first.generation)).rejects.toThrow();
      expect(await exports.read(next.token!)).not.toBeNull();
      expect(await s.overview(jwt, l.id)).toMatchObject({ connected: true, nights: 3 });
    });
  });
}
