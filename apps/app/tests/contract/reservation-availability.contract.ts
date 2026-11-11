import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CalendarChange } from "../../src/domain/calendar";
import { addDays } from "../../src/domain/dates";
import { costaRicaToday } from "../../src/domain/inquiry";
import type { AirbnbService } from "../../src/domain/airbnb";
import type { SubscriptionHarness } from "./harness";
import { TEST_AIRBNB_URL } from "../fixtures/airbnb-ical";

// La protección pertenece a la operación de marcar una reserva; editar un bloqueo manual sigue permitido.
const reservation = (days: string[]): CalendarChange & { requireFree: true } => ({ days, available: false, requireFree: true });
const BUSY = "Hay noches ocupadas entre esas fechas.";

export function reservationAvailabilityContract(name: string, make: () => Promise<{ h: SubscriptionHarness; service: AirbnbService }>) {
  describe(`Marcar reserva con disponibilidad · ${name}`, () => {
    let h: SubscriptionHarness;
    let service: AirbnbService;
    const day = (n: number) => addDays(costaRicaToday(Date.now()), n);
    beforeAll(async () => { ({ h, service } = await make()); }, 90_000);
    beforeEach(async () => h.reset(), 60_000);
    afterAll(async () => { if (h) await h.reset(); }, 60_000);

    it("rechaza una noche manual ya ocupada sin ocupar el resto del intervalo", async () => {
      const l = await h.seed({ status: "active" });
      const api = h.calendar("owner");
      await api.save(l.id, { days: [day(11)], available: false, priceCrc: 99_000 });
      await expect(api.save(l.id, reservation([day(10), day(11), day(12)]))).rejects.toThrow(BUSY);
      expect(await api.days(l.id)).toEqual([{ day: day(11), available: false, specialPriceCrc: 99_000 }]);
    });

    it("rechaza una importación que ocupa una noche después de haber leído el calendario", async () => {
      const l = await h.seed({ status: "active" });
      const api = h.calendar("owner");
      expect(await api.days(l.id)).toEqual([]);
      const request = crypto.randomUUID();
      await service.begin(await h.jwt("owner"), l.id, TEST_AIRBNB_URL, request);
      await service.context(l.id, request);
      await service.finish(l.id, request, [{ uid: "reserva-nueva", start: day(11), end: day(12) }], null);
      await expect(api.save(l.id, reservation([day(10), day(11), day(12)]))).rejects.toThrow(BUSY);
      expect(await api.days(l.id)).toEqual([expect.objectContaining({ day: day(11), available: false, imported: true })]);
    });

    it("la noche ocupada de salida no impide marcar las anteriores y conserva sus precios", async () => {
      const l = await h.seed({ status: "active" });
      const api = h.calendar("owner");
      await api.save(l.id, { days: [day(10)], priceCrc: 77_000 });
      await api.save(l.id, { days: [day(12)], available: false });
      await api.save(l.id, reservation([day(10), day(11)]));
      expect(await api.days(l.id)).toEqual([
        { day: day(10), available: false, specialPriceCrc: 77_000 },
        { day: day(11), available: false, specialPriceCrc: null },
        { day: day(12), available: false, specialPriceCrc: null },
      ]);
    });

    it("dos reservas simultáneas de las mismas noches no se confirman ambas", async () => {
      const l = await h.seed({ status: "active" });
      const api = h.calendar("owner");
      const results = await Promise.allSettled([
        api.save(l.id, reservation([day(10), day(11)])),
        api.save(l.id, reservation([day(10), day(11)])),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
      expect((await api.days(l.id)).map(d => d.day)).toEqual([day(10), day(11)]);
    });

    it("el editor general puede repetir o liberar un bloqueo manual", async () => {
      const l = await h.seed({ status: "active" });
      const api = h.calendar("owner");
      await api.save(l.id, reservation([day(10)]));
      await api.save(l.id, { days: [day(10)], available: false, priceCrc: 80_000 });
      await api.save(l.id, { days: [day(10)], available: true });
      expect(await api.days(l.id)).toEqual([{ day: day(10), available: true, specialPriceCrc: 80_000 }]);
    });

    it("la operación protegida no concede permisos al visitante ni a otro propietario", async () => {
      const l = await h.seed({ status: "active" });
      for (const role of ["anon", "other"] as const) {
        await expect(h.calendar(role).save(l.id, reservation([day(10)]))).rejects.toThrow();
      }
      expect(await h.calendar("owner").days(l.id)).toEqual([]);
    });
  });
}
