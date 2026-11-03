// Contrato del calendario (fase 4): días del propietario (save_listing_days), lectura pública (public_listing_days),
// cerrar con fecha de reapertura (set_listing_available de tres argumentos) y la reapertura nocturna
// (reopen_due_listings). Mismas reglas y mensajes en el fake (applyChange, validateChange) y en la base.
// Cada caso empieza con la base de casas vacía (el tope de 5 borradores sin enviar cuenta los que dejan otros casos) y
// siembra las suyas; la reapertura nocturna recorre toda la base, por eso solo se comprueban las casas propias.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CALENDAR_MESSAGES as M, type CalendarDay } from "../../src/domain/calendar";
import { DomainError } from "../../src/domain/errors";
import { parseFilters } from "../../src/domain/filters";
import { costaRicaToday } from "../../src/domain/inquiry";
import { PROVINCES } from "../../src/domain/listing";
import type { SeedSpec, SubscriptionHarness } from "./harness";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

const day = (offset: number) => costaRicaToday(Date.now() + offset * 86_400_000);
const BASE = 42_000; // COMPLETE.nightlyPriceCrc
const occupied = (d: string, specialPriceCrc: number | null = null): CalendarDay => ({ day: d, available: false, specialPriceCrc });
const special = (d: string, specialPriceCrc: number): CalendarDay => ({ day: d, available: true, specialPriceCrc });
const NO_NIGHTLY_PRICE: SeedSpec["draft"] = { nightlyPriceCrc: null };

export function calendarContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`calendario · ${name}`, () => {
    let h: SubscriptionHarness;
    const house = (spec: Partial<SeedSpec> = {}) => h.seed({ status: "active", ...spec });

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      await h.reset();
    }, 60_000);

    it("el propietario guarda y lee los días de su casa, en orden y solo los que difieren", async () => {
      const l = await house();
      const me = h.calendar("owner");
      expect(await me.days(l.id)).toEqual([]);
      await me.save(l.id, { days: [day(5), day(3), day(4), day(4)], available: false });
      await me.save(l.id, { days: [day(10)], priceCrc: 60_000 });
      expect(await me.days(l.id)).toEqual([occupied(day(3)), occupied(day(4)), occupied(day(5)), special(day(10), 60_000)]);
    });

    it("otro propietario lee [] aunque la casa esté publicada y no puede guardar", async () => {
      const l = await house();
      await h.calendar("owner").save(l.id, { days: [day(2)], available: false });
      const other = h.calendar("other");
      expect(await other.days(l.id)).toEqual([]);
      expect((await rejection(other.save(l.id, { days: [day(3)], available: false }))).message).toBe(M.notFound);
      expect((await rejection(other.save("00000000-0000-4000-8000-00000000dead", { days: [day(3)], available: false }))).message).toBe(M.notFound);
      expect(await h.calendar("owner").days(l.id)).toEqual([occupied(day(2))]);
    });

    it("sin sesión no se lee ni se guarda nada", async () => {
      const l = await house();
      expect((await rejection(h.calendar("anon").save(l.id, { days: [day(1)], available: false }))).kind).toBe("session");
      expect((await rejection(h.calendar("anon").days(l.id))).kind).toBe("session");
      expect(await h.calendar("owner").days(l.id)).toEqual([]);
    });

    it("ocupar conserva el precio y liberar también; el precio no cambia la disponibilidad", async () => {
      const l = await house();
      const me = h.calendar("owner");
      await me.save(l.id, { days: [day(7), day(8)], priceCrc: 80_000 });
      await me.save(l.id, { days: [day(7)], available: false });
      expect(await me.days(l.id)).toEqual([occupied(day(7), 80_000), special(day(8), 80_000)]);
      await me.save(l.id, { days: [day(7)], available: true });
      expect(await me.days(l.id)).toEqual([special(day(7), 80_000), special(day(8), 80_000)]);
      await me.save(l.id, { days: [day(9)], available: false });
      await me.save(l.id, { days: [day(9)], priceCrc: 50_000 });
      expect((await me.days(l.id)).at(-1)).toEqual(occupied(day(9), 50_000));
    });

    it("el precio base quita la ★ y, si el día está libre, borra la fila; disponibilidad y precio juntos", async () => {
      const l = await house();
      const me = h.calendar("owner");
      await me.save(l.id, { days: [day(1), day(2)], priceCrc: 90_000 });
      await me.save(l.id, { days: [day(2)], available: false });
      await me.save(l.id, { days: [day(1), day(2)], priceCrc: BASE });
      expect(await me.days(l.id)).toEqual([occupied(day(2))]);
      await me.save(l.id, { days: [day(2), day(3)], available: true, priceCrc: 70_000 });
      expect(await me.days(l.id)).toEqual([special(day(2), 70_000), special(day(3), 70_000)]);
      await me.save(l.id, { days: [day(2), day(3)], available: true, priceCrc: BASE });
      expect(await me.days(l.id)).toEqual([]);
    });

    it("la ventana: hoy y hoy + 365 sí; ayer y hoy + 366 no, y un día malo no guarda ninguno", async () => {
      const l = await house();
      const me = h.calendar("owner");
      await me.save(l.id, { days: [day(0), day(365)], available: false });
      for (const bad of [[day(-1)], [day(366)], [day(4), day(366)], [day(4), "2027-02-30"], []]) {
        expect((await rejection(me.save(l.id, { days: bad, available: false }))).message, bad.join(",")).toBe(M.range);
      }
      expect(await me.days(l.id)).toEqual([occupied(day(0)), occupied(day(365))]);
    });

    it("precios: de 1 a 100 000 000 colones, enteros; sin nada elegido no hay cambios", async () => {
      const l = await house();
      const me = h.calendar("owner");
      for (const price of [0, -5, 100_000_001, 1.5, Number.NaN]) {
        expect((await rejection(me.save(l.id, { days: [day(1), day(2)], priceCrc: price }))).message, String(price)).toBe(M.price);
      }
      expect((await rejection(me.save(l.id, { days: [day(1)] }))).message).toBe(M.nothing);
      expect(await me.days(l.id)).toEqual([]);
      await me.save(l.id, { days: [day(1)], priceCrc: 1 });
      await me.save(l.id, { days: [day(2)], priceCrc: 100_000_000 });
      expect(await me.days(l.id)).toEqual([special(day(1), 1), special(day(2), 100_000_000)]);
    });

    it("un borrador sin precio por noche todavía no lleva precio en el calendario, pero sí noches ocupadas", async () => {
      const l = await house({ status: "draft", draft: NO_NIGHTLY_PRICE });
      const me = h.calendar("owner");
      expect((await rejection(me.save(l.id, { days: [day(3)], priceCrc: 50_000 }))).message).toBe("Ponga primero el precio por noche de la casa para cambiar el de un día.");
      await me.save(l.id, { days: [day(3)], available: false });
      expect(await me.days(l.id)).toEqual([occupied(day(3))]);
    });

    it("cerrada a consultas no se edita y conserva sus días; rechazada tampoco; borrador, revisión, cambios y reabierta sí", async () => {
      const l = await house();
      const me = h.calendar("owner");
      await me.save(l.id, { days: [day(4)], available: false, priceCrc: 99_000 });
      await h.owner("owner").setAvailable(l.id, false);
      expect((await rejection(me.save(l.id, { days: [day(5)], available: false }))).message).toBe(M.closed);
      expect(await me.days(l.id)).toEqual([occupied(day(4), 99_000)]);
      await h.owner("owner").setAvailable(l.id, true);
      expect(await me.days(l.id)).toEqual([occupied(day(4), 99_000)]);

      const rejected = await house({ status: "rejected" });
      expect((await rejection(me.save(rejected.id, { days: [day(5)], available: false }))).message).toBe(M.rejected);
      expect(await me.days(rejected.id)).toEqual([]);

      for (const status of ["draft", "review", "changes", "reopened"] as const) {
        const other = await house({ status });
        await me.save(other.id, { days: [day(6)], available: false });
        expect(await me.days(other.id), status).toEqual([occupied(day(6))]);
      }
    });

    it("lectura pública: solo casas activas (también cerradas), solo la ventana; nunca los días de un borrador", async () => {
      const l = await house();
      const draft = await house({ status: "draft" });
      const reopened = await house({ status: "reopened" });
      const me = h.calendar("owner");
      await me.save(l.id, { days: [day(2)], available: false });
      await me.save(l.id, { days: [day(3)], priceCrc: 77_000 });
      await h.putDay(l.id, occupied(day(-1)));
      await h.putDay(l.id, occupied(day(366)));
      await me.save(draft.id, { days: [day(2)], available: false });
      await me.save(reopened.id, { days: [day(2)], available: false });

      expect(await h.anon.getPublicDays(l.publicId)).toEqual([occupied(day(2)), special(day(3), 77_000)]);
      expect(await me.days(l.id)).toEqual([occupied(day(2)), special(day(3), 77_000)]);
      expect(await h.anon.getPublicDays(draft.publicId)).toEqual([]);
      expect(await h.anon.getPublicDays(reopened.publicId)).toEqual([]);
      expect(await h.anon.getPublicDays("CT-999999")).toEqual([]);
      await h.owner("owner").setAvailable(l.id, false);
      expect(await h.anon.getPublicDays(l.publicId)).toEqual([occupied(day(2)), special(day(3), 77_000)]);
    });

    it("cerrar con fecha: de mañana a hoy + 365; abrir a mano la borra; una fecha al abrir se rechaza", async () => {
      const l = await house();
      const owner = h.owner("owner");
      for (const bad of [day(0), day(-3), day(366), "2027-02-30"]) {
        expect((await rejection(owner.setAvailable(l.id, false, bad))).message, bad).toBe(M.reopenDate);
      }
      expect((await owner.getOwn(l.id))?.available).toBe(true);
      await owner.setAvailable(l.id, false, day(1));
      expect(await owner.getOwn(l.id)).toMatchObject({ available: false, reopenAt: day(1), status: "active" });
      expect(await h.anon.getPublic(l.publicId)).toMatchObject({ available: false, reopenAt: day(1) });
      await owner.setAvailable(l.id, false, day(365));
      expect((await owner.getOwn(l.id))?.reopenAt).toBe(day(365));
      expect((await rejection(owner.setAvailable(l.id, true, day(10)))).message).toBe(M.reopenWhileOpen);
      await owner.setAvailable(l.id, true);
      expect(await owner.getOwn(l.id)).toMatchObject({ available: true, reopenAt: null });
      await owner.setAvailable(l.id, false);
      expect(await owner.getOwn(l.id)).toMatchObject({ available: false, reopenAt: null });

      const draft = await house({ status: "draft" });
      expect((await rejection(owner.setAvailable(draft.id, false, day(3)))).message).toBe(M.notActive);
      expect((await rejection(h.owner("other").setAvailable(l.id, true))).message).toBe(M.notActive);
    });

    it("la reapertura nocturna abre las casas cuya fecha llegó, deja las demás y nunca cambia el estado ni los días", async () => {
      const owner = h.owner("owner");
      const due = await house();
      const later = await house();
      const noDate = await house();
      const hidden = await house();
      await h.calendar("owner").save(due.id, { days: [day(3)], available: false, priceCrc: 66_000 });
      await owner.setAvailable(due.id, false, day(1));
      await owner.setAvailable(later.id, false, day(2));
      await owner.setAvailable(noDate.id, false);
      await owner.setAvailable(hidden.id, false, day(1));
      // Parada después de cerrarla (una casa publicada ya no vuelve a borrador): se abre igual y sigue parada.
      await h.billing("owner").stop(hidden.id);

      expect(await h.reopenDue(day(1))).toBeGreaterThanOrEqual(2);
      expect(await owner.getOwn(due.id)).toMatchObject({ available: true, reopenAt: null, status: "active" });
      expect(await owner.getOwn(hidden.id)).toMatchObject({ available: true, reopenAt: null, status: "inactive" });
      expect(await owner.getOwn(later.id)).toMatchObject({ available: false, reopenAt: day(2), status: "active" });
      expect(await owner.getOwn(noDate.id)).toMatchObject({ available: false, reopenAt: null, status: "active" });
      expect(await h.anon.getPublic(hidden.publicId)).toBeNull();
      expect(await h.calendar("owner").days(due.id)).toEqual([occupied(day(3), 66_000)]);
    });

    it("Explorar: solo casas libres todas esas noches (la salida no cuenta), también 30 o más; un enlace viejo del mensual no filtra", async () => {
      const A = day(20);
      const S = day(24);
      const free = await house();
      const busyInside = await house();
      const busyOnS = await house();
      const lastOfThirty = await house({ draft: { acceptsMonthly: true } });
      const afterThirty = await house({ draft: { acceptsMonthly: true } });
      await h.putDay(busyInside.id, occupied(day(22)));
      await h.putDay(busyOnS.id, occupied(S));
      await h.putDay(lastOfThirty.id, occupied(day(10 + 29))); // la última de las 30 noches desde el día 10
      await h.putDay(afterThirty.id, occupied(day(10 + 30))); // el día de salida
      const search = async (params: Record<string, string>) =>
        (await h.anon.searchPublic(parseFilters({ prov: "Todas", ...params }, PROVINCES, { today: day(0) }))).map((l) => l.publicId);
      const nightly = await search({ llegada: A, salida: S });
      expect(nightly).toEqual(expect.arrayContaining([free.publicId, busyOnS.publicId, lastOfThirty.publicId, afterThirty.publicId]));
      expect(nightly).not.toContain(busyInside.publicId);
      const thirty = await search({ llegada: day(10), salida: day(40) });
      expect(thirty).toContain(afterThirty.publicId);
      expect(thirty).not.toContain(lastOfThirty.publicId);
      // Antes, «mensual» y «desde» pedían esas 30 noches libres; ahora no filtran nada.
      expect(await search({ mensual: "1", desde: day(10) })).toEqual(await search({}));
    });
  });
}
