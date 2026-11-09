import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AirbnbService } from "../../src/domain/airbnb";
import { addDays } from "../../src/domain/calendar";
import type { IcalExportService } from "../../src/domain/ical-export";
import { serializeManualCalendar } from "../../src/domain/ical-export";
import { parseAirbnbCalendar } from "../../src/domain/ical";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { SubscriptionHarness } from "./harness";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";

export function icalExportContract(name: string, make: () => Promise<{ h: SubscriptionHarness; service: IcalExportService; imports: AirbnbService }>) {
  describe(`Exportación iCal · ${name}`, () => {
    let h: SubscriptionHarness;
    let service: IcalExportService;
    let imports: AirbnbService;
    const day = (n: number) => addDays(costaRicaToday(Date.now()), n);
    beforeAll(async () => { ({ h, service, imports } = await make()); }, 90_000);
    beforeEach(async () => h.reset(), 60_000);
    afterAll(async () => { if (h) await h.reset(); }, 60_000);
    async function generate(id: string) {
      const result = await service.owner(await h.jwt("owner"), id, true);
      if (!result.token) throw new Error("No se generó el enlace de prueba.");
      return result.token;
    }
    async function importBlocks(id: string, blocks: { uid: string; start: string; end: string }[]) {
      const request = crypto.randomUUID();
      await imports.begin(await h.jwt("owner"), id, TEST_AIRBNB_URL, request);
      await imports.context(id, request);
      await imports.finish(id, request, blocks, null);
    }

    it("genera un enlace idempotente por casa sin necesitar conectar importación", async () => {
      const a = await h.seed({ status: "active" });
      const b = await h.seed({ status: "active" });
      const jwt = await h.jwt("owner");
      expect(await service.owner(jwt, a.id, false)).toEqual({ generated: false, suspended: false, token: null, nights: 0 });
      const [first, repeated] = await Promise.all([service.owner(jwt, a.id, true), service.owner(jwt, a.id, true)]);
      expect(first.generated && !first.suspended).toBe(true);
      expect(typeof first.token === "string" && /^[a-f0-9]{64}$/.test(first.token)).toBe(true);
      expect(first.token === repeated.token).toBe(true);
      const metadata = await imports.overview(jwt, a.id);
      expect(metadata.exportGenerated).toBe(true);
      expect(typeof first.token === "string" && JSON.stringify(metadata).includes(first.token)).toBe(false);
      const otherToken = await generate(b.id);
      expect(first.token === otherToken).toBe(false);
      expect((await imports.overview(jwt, a.id)).connected).toBe(false);
    });

    it("otra cuenta y sesión ausente no pueden obtener, generar ni revocar el enlace", async () => {
      const l = await h.seed({ status: "active" });
      const token = await generate(l.id);
      for (const jwt of [await h.jwt("other"), ""]) {
        await expect(service.owner(jwt, l.id, false)).rejects.toThrow();
        await expect(service.owner(jwt, l.id, true)).rejects.toThrow();
        await expect(service.revoke(jwt, l.id)).rejects.toThrow();
      }
      expect(await service.read(token)).not.toBeNull();
      const draft = await h.seed({ status: "draft" });
      await expect(service.owner(await h.jwt("owner"), draft.id, true)).rejects.toThrow();
    });

    it("exporta solo manuales; liberar una coincidencia retira el evento y conserva Airbnb y precio", async () => {
      const l = await h.seed({ status: "active" });
      await h.calendar("owner").save(l.id, { days: [day(10), day(11)], available: false, priceCrc: 75000 });
      await importBlocks(l.id, [{ uid: "origen-externo", start: day(11), end: day(14) }]);
      const token = await generate(l.id);
      expect((await service.read(token))?.nights).toEqual([day(10), day(11)]);
      await h.calendar("owner").save(l.id, { days: [day(11)], available: true });
      expect((await service.read(token))?.nights).toEqual([day(10)]);
      const overlap = (await h.calendar("owner").days(l.id)).find(d => d.day === day(11));
      expect(overlap).toMatchObject({ available: false, imported: true, manualAvailable: true, specialPriceCrc: 75000 });
      expect((await imports.overview(await h.jwt("owner"), l.id)).nights).toBe(3);
    });

    it("sirve las 366 noches admitidas sin truncar y excluye fechas fuera de ventana", async () => {
      const l = await h.seed({ status: "active" });
      const all = Array.from({ length: 366 }, (_, i) => day(i));
      await h.calendar("owner").save(l.id, { days: all, available: false });
      await h.putDay(l.id, { day: day(-1), available: false, specialPriceCrc: null });
      await h.putDay(l.id, { day: day(366), available: false, specialPriceCrc: null });
      const token = await generate(l.id);
      const snapshot = await service.read(token);
      expect(snapshot?.nights).toEqual(all);
      expect((await service.owner(await h.jwt("owner"), l.id, false)).nights).toBe(366);
      if (!snapshot) throw new Error("No se leyó el calendario de prueba.");
      const blocks = parseAirbnbCalendar(serializeManualCalendar(snapshot, Date.now()));
      expect(blocks.at(-1)?.end).toBe(day(366));
    });

    it("una consulta por WhatsApp y un precio especial no crean eventos", async () => {
      const l = await h.seed({ status: "active" });
      const token = await generate(l.id);
      await h.calendar("owner").save(l.id, { days: [day(20)], priceCrc: 75000 });
      await h.inquiries("other").create(l.publicId, { arrival: day(20), departure: day(22), people: 1, message: "Consulta de prueba" });
      expect((await service.read(token))?.nights).toEqual([]);
      expect((await service.owner(await h.jwt("owner"), l.id, false)).nights).toBe(0);
    });

    it("revocar invalida el token anterior y regenerar no lo recupera ni renumera UID", async () => {
      const l = await h.seed({ status: "active" });
      await h.calendar("owner").save(l.id, { days: [day(10)], available: false });
      const jwt = await h.jwt("owner");
      const token = await generate(l.id);
      const before = await service.read(token);
      await service.revoke(jwt, l.id);
      expect(await service.read(token)).toBeNull();
      expect((await imports.overview(jwt, l.id)).exportGenerated).toBe(false);
      expect(await service.owner(jwt, l.id, false)).toMatchObject({ generated: false, token: null });
      const next = await generate(l.id);
      expect(next === token).toBe(false);
      expect(await service.read(token)).toBeNull();
      expect((await service.read(next))?.id).toBe(before?.id);
      expect(await service.read("corto")).toBeNull();
      expect(await service.read("0".repeat(64))).toBeNull();
    });

    it("pausar mantiene el enlace, bloquear lo suspende y eliminar lo invalida", async () => {
      const l = await h.seed({ status: "active" });
      const token = await generate(l.id);
      const jwt = await h.jwt("owner");
      await h.owner("owner").setAvailable(l.id, false);
      expect(await service.read(token)).not.toBeNull();
      await h.admin("aal2").blockListing(l.id, "Bloqueo de prueba");
      expect(await service.read(token)).toBeNull();
      expect(await service.owner(jwt, l.id, false)).toMatchObject({ generated: true, suspended: true, token: null });
      await expect(service.owner(jwt, l.id, true)).rejects.toThrow();
      await h.admin("aal2").unblockListing(l.id);
      expect(await service.read(token)).not.toBeNull();
      await h.admin("aal2").deleteListing(l.id, "Eliminación de prueba", l.publicId);
      expect(await service.read(token)).toBeNull();
      await expect(service.owner(jwt, l.id, false)).rejects.toThrow();
    });

    it("desactivar una cuenta bloquea lectura y generación sin destruir el enlace", async () => {
      const l = await h.seed({ status: "active" });
      const token = await generate(l.id);
      await h.setAccountActive("owner", false);
      try {
        expect(await service.read(token)).toBeNull();
        await expect(service.owner(await h.jwt("owner"), l.id, true)).rejects.toThrow();
      } finally { await h.setAccountActive("owner", true); }
      expect(await service.read(token)).not.toBeNull();
    });

    it("la copia importada de un bloqueo propio no se devuelve al liberar el manual", async () => {
      const l = await h.seed({ status: "active" });
      await h.calendar("owner").save(l.id, { days: [day(10)], available: false });
      const token = await generate(l.id);
      const snapshot = await service.read(token);
      if (!snapshot) throw new Error("No se leyó el calendario de prueba.");
      const echoed = parseAirbnbCalendar(serializeManualCalendar(snapshot, Date.now()));
      await importBlocks(l.id, echoed);
      await h.calendar("owner").save(l.id, { days: [day(10)], available: true });
      expect((await h.calendar("owner").days(l.id)).find(d => d.day === day(10))?.available).toBe(false);
      expect((await service.read(token))?.nights).toEqual([]);
    });
  });
}
