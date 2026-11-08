import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AirbnbService } from "../../src/domain/airbnb";
import { addDays, effectiveDay } from "../../src/domain/calendar";
import { costaRicaToday } from "../../src/domain/inquiry";
import { parseFilters } from "../../src/domain/filters";
import { PROVINCES } from "../../src/domain/listing";
import type { SubscriptionHarness } from "./harness";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";

export function airbnbContract(name: string, make: () => Promise<{ h: SubscriptionHarness; service: AirbnbService }>) {
  describe(`Airbnb · ${name}`, () => {
    let h: SubscriptionHarness;
    let s: AirbnbService;
    const day = (n: number) => addDays(costaRicaToday(Date.now()), n);
    beforeAll(async () => { ({ h, service: s } = await make()); }, 90_000);
    beforeEach(async () => h.reset(), 60_000);

    async function first(listingId: string) {
      const jwt = await h.jwt("owner");
      const requestId = crypto.randomUUID();
      expect((await s.begin(jwt, listingId, TEST_AIRBNB_URL, requestId)).run).toBe(true);
      expect(await s.context(listingId, requestId)).toEqual({ url: TEST_AIRBNB_URL });
      await s.finish(listingId, requestId, [{ uid: "reserva-falsa", start: day(10), end: day(13) }], null);
      return { jwt, requestId };
    }

    it("solo el dueño conecta; otro usuario y una sesión ausente no modifican nada", async () => {
      const l = await h.seed({ status: "active" });
      await expect(s.begin(await h.jwt("other"), l.id, TEST_AIRBNB_URL, crypto.randomUUID())).rejects.toThrow();
      await expect(s.begin("", l.id, TEST_AIRBNB_URL, crypto.randomUUID())).rejects.toThrow();
      expect((await s.overview(await h.jwt("owner"), l.id)).connected).toBe(false);
      expect(await h.anon.getPublicDays(l.publicId)).toEqual([]);
    });

    it("la salida no ocupa noche; búsqueda y contacto respetan Airbnb", async () => {
      const l = await h.seed({ status: "active" });
      await first(l.id);
      const days = await h.anon.getPublicDays(l.publicId);
      expect(days.filter(d => !d.available).map(d => d.day)).toEqual([day(10), day(11), day(12)]);
      const busy = parseFilters({ llegada: day(10), salida: day(13) }, PROVINCES);
      // Fijar también las claves vigentes mediante la ruta de filtros: si cambian, el caso no puede pasar sin fechas.
      expect(busy.arrival).toBe(day(10));
      const found = await h.anon.searchPublic(busy);
      expect(found.some(r => r.id === l.id)).toBe(false);
      await expect(h.inquiries("other").create(l.publicId, { arrival: day(10), departure: day(13), people: 1, message: "Consulta de prueba" })).rejects.toThrow("Hay noches ocupadas");
      await expect(h.inquiries("other").create(l.publicId, { arrival: day(9), departure: day(10), people: 1, message: "Consulta de prueba" })).resolves.toHaveProperty("inquiryId");
      expect((await s.overview(await h.jwt("owner"), l.id)).nights).toBe(3);
    });

    it("quitar el manual conserva Airbnb y su precio especial", async () => {
      const l = await h.seed({ status: "active" });
      await h.calendar("owner").save(l.id, { days: [day(11)], available: false, priceCrc: 75000 });
      await first(l.id);
      await h.calendar("owner").save(l.id, { days: [day(11)], available: true });
      const row = (await h.calendar("owner").days(l.id)).find(d => d.day === day(11));
      expect(row).toMatchObject({ available: false, imported: true, manualAvailable: true, specialPriceCrc: 75000 });
      expect(effectiveDay(await h.calendar("owner").days(l.id), 42000, day(11)).available).toBe(false);
    });

    it("una repetición del requestId no vuelve a ejecutar ni duplica noches", async () => {
      const l = await h.seed({ status: "active" });
      const { jwt, requestId } = await first(l.id);
      const before = await s.overview(jwt, l.id);
      expect((await s.begin(jwt, l.id, TEST_AIRBNB_URL, requestId)).run).toBe(false);
      await s.finish(l.id, requestId, [], null);
      expect(await s.overview(jwt, l.id)).toEqual(before);
      expect((await h.anon.getPublicDays(l.publicId)).filter(d => !d.available)).toHaveLength(3);
    });

    it("cambios y cancelaciones sustituyen solo importados; vacío válido conserva manuales", async () => {
      const l = await h.seed({ status: "active" });
      await h.calendar("owner").save(l.id, { days: [day(11)], available: false, priceCrc: 75000 });
      const { jwt } = await first(l.id);
      const change = crypto.randomUUID();
      await s.claim(l.id, change);
      await s.context(l.id, change);
      await s.finish(l.id, change, [{ uid: "reserva-falsa", start: day(12), end: day(14) }, { uid: "otra", start: day(13), end: day(15) }], null);
      expect((await h.anon.getPublicDays(l.publicId)).filter(d => !d.available).map(d => d.day)).toEqual([day(11), day(12), day(13), day(14)]);
      const cancel = crypto.randomUUID();
      await s.claim(l.id, cancel);
      await s.context(l.id, cancel);
      await s.finish(l.id, cancel, [], null);
      expect(await h.calendar("owner").days(l.id)).toEqual([{ day: day(11), available: false, specialPriceCrc: 75000 }]);
      expect((await s.overview(jwt, l.id)).connected).toBe(true);
      expect((await s.overview(jwt, l.id)).nights).toBe(0);
    });

    it("un fallo conserva instantánea y fecha del último éxito", async () => {
      const l = await h.seed({ status: "active" });
      const { jwt } = await first(l.id);
      const before = await s.overview(jwt, l.id);
      const request = crypto.randomUUID();
      await s.claim(l.id, request);
      await s.context(l.id, request);
      await s.finish(l.id, request, null, "download");
      const after = await s.overview(jwt, l.id);
      expect(after).toMatchObject({ connected: true, errorCode: "download", lastSuccessAt: before.lastSuccessAt, nights: 3 });
      expect((await h.anon.getPublicDays(l.publicId)).filter(d => !d.available)).toHaveLength(3);
      expect(JSON.stringify(after)).not.toContain("?t=");
    });

    it("no hay dos importaciones en vuelo y el contexto se reclama una sola vez", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await h.jwt("owner");
      const request = crypto.randomUUID();
      await s.begin(jwt, l.id, TEST_AIRBNB_URL, request);
      await expect(s.begin(jwt, l.id, TEST_AIRBNB_URL, crypto.randomUUID())).rejects.toThrow();
      expect(await s.context(l.id, request)).toEqual({ url: TEST_AIRBNB_URL });
      expect(await s.context(l.id, request)).toBeNull();
    });

    it("un borrador nunca enviado no conecta, pero una casa pausada sí mantiene importación", async () => {
      const draft = await h.seed({ status: "draft" });
      await expect(s.begin(await h.jwt("owner"), draft.id, TEST_AIRBNB_URL, crypto.randomUUID())).rejects.toThrow();
      const l = await h.seed({ status: "active" });
      await h.owner("owner").setAvailable(l.id, false);
      await first(l.id);
      expect((await s.overview(await h.jwt("owner"), l.id)).nights).toBe(3);
      expect((await h.owner("owner").getOwn(l.id))?.available).toBe(false);
    });

    it("bloquear y desbloquear invalida una lectura anterior sin borrar la última instantánea válida", async () => {
      const l = await h.seed({ status: "active" });
      const { jwt } = await first(l.id);
      const request = crypto.randomUUID();
      await s.claim(l.id, request);
      await s.context(l.id, request);
      await h.admin("aal2").blockListing(l.id, "Bloqueo de prueba");
      await h.admin("aal2").unblockListing(l.id);
      await s.finish(l.id, request, [], null);
      expect((await s.overview(jwt, l.id)).nights).toBe(3);
    });

    it("recorta al proyectar la ventana sin expandir un rango externo ni ocupar la salida", async () => {
      const l = await h.seed({ status: "active" });
      const jwt = await h.jwt("owner");
      const request = crypto.randomUUID();
      await s.begin(jwt, l.id, TEST_AIRBNB_URL, request);
      await s.context(l.id, request);
      await s.finish(l.id, request, [
        { uid: "comienzo", start: day(-10), end: day(1) },
        { uid: "ultimo", start: day(365), end: day(370) },
        { uid: "fuera", start: day(400), end: day(500) },
      ], null);
      expect((await h.anon.getPublicDays(l.publicId)).map(d => d.day)).toEqual([day(0), day(365)]);
      expect((await s.overview(jwt, l.id)).nights).toBe(2);
    });

    it("desactivar la cuenta durante una lectura impide publicar el resultado", async () => {
      const l = await h.seed({ status: "active" });
      const { jwt } = await first(l.id);
      const request = crypto.randomUUID();
      await s.claim(l.id, request);
      await s.context(l.id, request);
      await h.setAccountActive("owner", false);
      try {
        await s.finish(l.id, request, [], null);
        expect((await s.overview(jwt, l.id)).nights).toBe(3);
      } finally { await h.setAccountActive("owner", true); }
    });
  });
}
