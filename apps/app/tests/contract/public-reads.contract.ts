// Contrato de las lecturas públicas: catálogo con filtros, ficha, estado del enlace y provincias con casas.
import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/dates";
import { DomainError } from "../../src/domain/errors";
import { parseFilters, type Filters } from "../../src/domain/filters";
import { costaRicaToday } from "../../src/domain/inquiry";
import { PROVINCES } from "../../src/domain/listing";
import { APPROX_MAX_METERS, APPROX_MIN_METERS, distanceMeters } from "../../src/domain/geo";
import { stayEstimate, stayNights } from "../../src/domain/stay-price";
import type { CalendarHarness, Seeded } from "./harness";
import { PUERTO_VIEJO } from "./points";

const filters = (params: Record<string, string> = {}): Filters => parseFilters({ prov: "Todas", ...params }, PROVINCES);

export function publicReadsContract(name: string, makeHarness: () => Promise<CalendarHarness>) {
  describe(`lecturas públicas · ${name}`, () => {
    let h: CalendarHarness;
    const ids = async (f: Filters) => (await h.anon.searchPublic(f)).map((l) => l.publicId);

    describe("visibilidad y forma", () => {
      let active: Seeded;
      let draft: Seeded;
      let review: Seeded;
      let changes: Seeded;
      let rejected: Seeded;
      let reopened: Seeded;

      beforeAll(async () => {
        h = await makeHarness();
        await h.reset();
        draft = await h.seed({ status: "draft" });
        review = await h.seed({ status: "review" });
        changes = await h.seed({ status: "changes" });
        rejected = await h.seed({ status: "rejected" });
        reopened = await h.seed({ status: "reopened" });
        active = await h.seed({ status: "active", photos: 6, draft: { title: "Casa Punta Uva", zone: "Punta Uva", zoneSource: "other", zoneId: null } });
      }, 60_000);

      it("el catálogo solo trae casas activas", async () => {
        expect(await ids(filters())).toEqual([active.publicId]);
      });

      it("la casa pública trae nombre del dueño, fotos en orden y el punto desplazado, nunca el exacto", async () => {
        const [l] = await h.anon.searchPublic(filters());
        expect(l).toMatchObject({ publicId: active.publicId, title: "Casa Punta Uva", zone: "Punta Uva", province: "Limón", ownerName: h.ownerName("owner"), ownerWhatsappVerified: true });
        expect(l!.photos.map((p) => p.path)).toEqual(active.photoPaths);
        expect(l!.photos[0]!.url).toMatch(new RegExp(`/storage/v1/object/public/listings/${active.photoPaths[0]}$`));
        const d = distanceMeters(active.exact, l!.approx!);
        expect(d).toBeGreaterThanOrEqual(APPROX_MIN_METERS - 1);
        expect(d).toBeLessThanOrEqual(APPROX_MAX_METERS + 1);
        expect(l).not.toHaveProperty("whatsappPhone");
        expect(JSON.stringify(l)).not.toContain("+506");
      });

      it("el punto desplazado es siempre el mismo para la misma casa", async () => {
        const a = await h.anon.getPublic(active.publicId);
        const b = await h.anon.getPublic(active.publicId);
        expect(a!.approx).toEqual(b!.approx);
      });

      it("getPublic devuelve la casa activa y null para cualquier otra", async () => {
        expect((await h.anon.getPublic(active.publicId))?.title).toBe("Casa Punta Uva");
        for (const s of [draft, review, changes, rejected, reopened]) expect(await h.anon.getPublic(s.publicId)).toBeNull();
        expect(await h.anon.getPublic("CT-999999")).toBeNull();
      });

      it("getManyPublic (Favoritos): solo las activas de la lista, sin fallar por las demás", async () => {
        const all = [draft, review, changes, rejected, reopened, active].map((s) => s.publicId);
        const found = await h.anon.getManyPublic([...all, "CT-999999", active.publicId]);
        expect(found.map((l) => l.publicId)).toEqual([active.publicId]);
        expect(found[0]).toMatchObject({ title: "Casa Punta Uva", ownerName: h.ownerName("owner") });
        expect(found[0]!.photos.map((p) => p.path)).toEqual(active.photoPaths);
        expect(await h.anon.getManyPublic([])).toEqual([]);
        expect(await h.anon.getManyPublic(["CT-999999"])).toEqual([]);
      });

      it("countActive cuenta solo las casas activas", async () => {
        expect(await h.anon.countActive()).toBe(1);
      });

      it("sitemap: solo casas activas, con su fecha de actualización", async () => {
        const entries = await h.anon.sitemap();
        expect(entries.map((e) => e.publicId)).toEqual([active.publicId]);
        expect(Number.isNaN(Date.parse(entries[0]!.updatedAt))).toBe(false);
      });

      it("linkState: activa, bloqueada si alguna vez se envió, no existe si es un borrador nunca enviado", async () => {
        expect(await h.anon.linkState(active.publicId)).toBe("active");
        expect(await h.anon.linkState(draft.publicId)).toBeNull();
        expect(await h.anon.linkState("CT-999999")).toBeNull();
        for (const s of [review, changes, rejected, reopened]) expect(await h.anon.linkState(s.publicId)).toBe("blocked");
      });
    });

    describe("filtros y orden", () => {
      let cahuita: Seeded;
      let mensual: Seeded;
      let grande: Seeded;
      let nicoya: Seeded;

      beforeAll(async () => {
        h = await makeHarness();
        await h.reset();
        cahuita = await h.seed({ status: "active", draft: { capacity: 2, bedrooms: 1, features: ["wifi"], nightlyPriceCrc: 42000 } });
        mensual = await h.seed({
          status: "active",
          as: "other",
          draft: { acceptsMonthly: true, monthlyPriceCrc: null, nightlyPriceCrc: 38000, capacity: 4, bedrooms: 2, features: ["wifi", "pets"] },
        });
        grande = await h.seed({ status: "active", draft: { acceptsMonthly: true, monthlyPriceCrc: 900000, capacity: 8, bedrooms: 4, features: ["pool", "wifi", "parking"], parkingPaid: false, nightlyPriceCrc: 150000 } });
        nicoya = await h.seed({ status: "active", draft: { province: "Guanacaste", canton: "Nicoya", zone: "Sámara", zoneSource: "other", zoneId: null, lat: 9.88, lng: -85.53, nightlyPriceCrc: 60000 } });
      }, 60_000);

      it("más recientes primero", async () => {
        expect(await ids(filters())).toEqual([nicoya.publicId, grande.publicId, mensual.publicId, cahuita.publicId]);
      });

      it("provincia", async () => {
        expect(await ids(filters({ prov: "Guanacaste" }))).toEqual([nicoya.publicId]);
        expect(await ids(parseFilters({ prov: "Limón" }, ["Limón"]))).toEqual([grande.publicId, mensual.publicId, cahuita.publicId]);
      });

      it("fin del modo mensual: ?mensual=1, ?modo=monthly y ?desde= no filtran, y el rango por noche vale siempre", async () => {
        const all = await ids(filters());
        expect(all).toHaveLength(4);
        expect(await ids(filters({ mensual: "1" }))).toEqual(all);
        expect(await ids(filters({ modo: "monthly" }))).toEqual(all);
        expect(await ids(filters({ desde: addDays(costaRicaToday(Date.now()), 10) }))).toEqual(all);
        // mensual: 38 000 la noche; grande: 150 000. Antes, con el mensual, el rango no se aplicaba y salían las dos.
        expect(await ids(filters({ mensual: "1", min: "50000", max: "100000" }))).toEqual([nicoya.publicId]);
        expect(await h.anon.getPublic(mensual.publicId)).toMatchObject({ acceptsNightly: true, acceptsMonthly: true, monthlyPriceCrc: null });
      });

      it("personas y habitaciones como mínimo", async () => {
        expect(await ids(filters({ ppl: "4" }))).toEqual([grande.publicId, mensual.publicId]);
        expect(await ids(filters({ beds: "3" }))).toEqual([grande.publicId]);
      });

      it("características: todas las pedidas", async () => {
        expect(await ids(filters({ wifi: "1", pets: "1" }))).toEqual([mensual.publicId]);
        expect(await ids(filters({ pool: "1" }))).toEqual([grande.publicId]);
      });

      it("precio por noche: mínimo y máximo", async () => {
        expect(await ids(filters({ min: "50000" }))).toEqual([nicoya.publicId, grande.publicId]);
        expect(await ids(filters({ max: "60000" }))).toEqual([nicoya.publicId, mensual.publicId, cahuita.publicId]);
        expect(await ids(filters({ min: "45000", max: "100000" }))).toEqual([nicoya.publicId]);
      });

      it("provincias con casas activas, en el orden de la lista", async () => {
        expect(await h.anon.provincesWithListings()).toEqual(["Guanacaste", "Limón"]);
      });

      it("countActive: las cuatro casas activas, de cualquier propietario", async () => {
        expect(await h.anon.countActive()).toBe(4);
      });
    });
    describe("total orientativo de la estancia (ronda 2 nov, ticket 07)", () => {
      const today = costaRicaToday(Date.now());
      const day = (n: number) => addDays(today, n);
      type House = { seeded: Seeded; base: number; acceptsMonthly: boolean; monthlyCrc: number | null; days: { day: string; available: boolean; specialPriceCrc: number }[] };
      const houses: Record<"especiales" | "mesNegociable" | "conMes" | "redondeo" | "salidaEspecial", House> = {} as never;
      /** Los totales de las casas devueltas para [llegada, salida), por id público. */
      const totals = async (from: number, to: number) => {
        const list = await h.anon.searchPublic(parseFilters({ prov: "Todas", llegada: day(from), salida: day(to) }, PROVINCES, { today }));
        return Object.fromEntries(list.map((l) => [l.publicId, l.stayTotalCrc]));
      };
      /** Lo que dice la regla del dominio (stay-price.ts) para cada casa: fake y PostgREST tienen que dar esto mismo. */
      const expected = (from: number, to: number) =>
        Object.fromEntries(
          Object.values(houses).map((x) => [x.seeded.publicId, stayEstimate({ nights: stayNights(day(from), day(to)), days: x.days, base: x.base, acceptsMonthly: x.acceptsMonthly, monthlyCrc: x.monthlyCrc })?.totalCrc ?? null]),
        );

      beforeAll(async () => {
        h = await makeHarness();
        await h.reset();
        const make = async (base: number, acceptsMonthly: boolean, monthlyCrc: number | null, specials: [number, number][] = []): Promise<House> => {
          const seeded = await h.seed({ status: "active", photos: 1, draft: { nightlyPriceCrc: base, acceptsMonthly, monthlyPriceCrc: monthlyCrc } });
          const days = specials.map(([n, specialPriceCrc]) => ({ day: day(n), available: true, specialPriceCrc }));
          for (const d of days) await h.putDay(seeded.id, d);
          return { seeded, base, acceptsMonthly, monthlyCrc, days };
        };
        // Noches de las búsquedas: de 20 a 24 (4), 49 (29), 50 (30), 51 (31) y 65 (45).
        houses.especiales = await make(42000, false, null, [[21, 80000], [22, 30000]]); // uno más caro y uno más barato
        houses.mesNegociable = await make(38000, true, null, [[30, 50000]]); // acepta mensual sin precio: por noches siempre
        houses.conMes = await make(150000, true, 900000, [[21, 200000]]);
        houses.redondeo = await make(100000, true, 1000001);
        houses.salidaEspecial = await make(60000, false, null, [[24, 1]]); // la noche del día 24: salida de la búsqueda de 4 noches
      }, 120_000);

      it("sin llegada ni salida no hay total", async () => {
        const list = await h.anon.searchPublic(filters());
        expect(list).toHaveLength(5);
        for (const l of list) expect(l.stayTotalCrc).toBeNull();
      });

      it("4 noches: la suma de cada noche con su precio especial; la de la salida no cuenta; el precio al mes no se usa", async () => {
        const got = await totals(20, 24);
        expect(got).toEqual(expected(20, 24));
        expect(got).toEqual({
          [houses.especiales.seeded.publicId]: 42000 + 80000 + 30000 + 42000,
          [houses.mesNegociable.seeded.publicId]: 4 * 38000,
          [houses.conMes.seeded.publicId]: 200000 + 3 * 150000,
          [houses.redondeo.seeded.publicId]: 4 * 100000,
          [houses.salidaEspecial.seeded.publicId]: 4 * 60000,
        });
      });

      it("29 noches por noches; desde 30, el mes prorrateado si tiene precio al mes (sin especiales) y si no, por noches", async () => {
        expect(await totals(20, 49)).toEqual(expected(20, 49));
        expect((await totals(20, 49))[houses.conMes.seeded.publicId]).toBe(200000 + 28 * 150000);
        const thirty = await totals(20, 50);
        expect(thirty).toEqual(expected(20, 50));
        expect(thirty[houses.conMes.seeded.publicId]).toBe(900000);
        expect(thirty[houses.mesNegociable.seeded.publicId]).toBe(29 * 38000 + 50000);
        expect(thirty[houses.salidaEspecial.seeded.publicId]).toBe(29 * 60000 + 1); // el día 24 ya es una noche de la estancia
        const fortyFive = await totals(20, 65);
        expect(fortyFive).toEqual(expected(20, 65));
        expect(fortyFive[houses.conMes.seeded.publicId]).toBe(1350000);
      });

      it("el mes prorrateado se redondea al colón como Math.round (31 noches de 1 000 001 al mes)", async () => {
        const got = await totals(20, 51);
        expect(got).toEqual(expected(20, 51));
        expect(got[houses.redondeo.seeded.publicId]).toBe(1033334);
      });
    });

    describe("límite de 60 (ronda 2 nov, ticket 07: ahora lo pone search_listings)", () => {
      it("62 casas: salen las 60 más nuevas, cada una con su total; sin fechas, sin total", async () => {
        h = await makeHarness();
        await h.reset();
        const made: Seeded[] = [];
        for (let i = 0; i < 62; i++) made.push(await h.seed({ status: "active", photos: 1, draft: { nightlyPriceCrc: 40000 + i } }));
        const today = costaRicaToday(Date.now());
        const list = await h.anon.searchPublic(parseFilters({ prov: "Todas", llegada: addDays(today, 10), salida: addDays(today, 13) }, PROVINCES, { today }));
        expect(list.map((l) => l.publicId)).toEqual(made.slice(2).reverse().map((m) => m.publicId));
        for (const l of list) expect(l.stayTotalCrc).toBe(3 * l.nightlyPriceCrc!);
        const plain = await h.anon.searchPublic(filters());
        expect(plain.map((l) => l.publicId)).toEqual(list.map((l) => l.publicId));
        for (const l of plain) expect(l.stayTotalCrc).toBeNull();
      }, 240_000);
    });

    describe("zona (5 km)", () => {
      let pv: Seeded;
      let cahuita: Seeded;

      beforeAll(async () => {
        h = await makeHarness();
        await h.reset();
        cahuita = await h.seed({ status: "active" });
        pv = await h.seed({ status: "active", draft: { title: "Casa Puerto Viejo", zone: "Puerto Viejo", zoneSource: "other", zoneId: null, ...PUERTO_VIEJO } });
      }, 60_000);

      it("la zona trae las casas a 5 km o menos de su punto (o con esa zona) y manda sobre la provincia", async () => {
        expect(await ids(filters({ zona: "704-cocles" }))).toEqual([pv.publicId]); // Puerto Viejo, a ~2,9 km de Cocles
        expect(await ids(filters({ zona: "704-cahuita" }))).toEqual([cahuita.publicId]);
        expect(await ids(filters({ zona: "704-cocles", prov: "Guanacaste" }))).toEqual([pv.publicId]);
      });

      it("zonesWithListings: las zonas con casas activas y abiertas cerca, con cantón y provincia", async () => {
        const zones = await h.anon.zonesWithListings();
        expect(zones).toContainEqual(expect.objectContaining({ id: "704-cocles", name: "Cocles", canton: "Talamanca", province: "Limón" }));
        expect(zones).toContainEqual(expect.objectContaining({ id: "704-puerto-viejo" }));
        expect(zones.map((z) => z.id)).not.toContain("701-limon-centro");
        await h.owner("owner").setAvailable(pv.id, false);
        expect((await h.anon.zonesWithListings()).map((z) => z.id)).not.toContain("704-cocles");
        await h.owner("owner").setAvailable(pv.id, true);
      });

      it("un rango de fechas inválido se rechaza con «Revise las fechas.»", async () => {
        const today = costaRicaToday(Date.now());
        const p = h.anon.searchPublic({ ...filters(), arrival: addDays(today, -1), departure: addDays(today, 2) });
        await expect(p).rejects.toBeInstanceOf(DomainError);
        await expect(p).rejects.toThrow("Revise las fechas.");
      });
    });

    describe("anuncio pausado (ticket 20)", () => {
      it("no aparece en Explorar, pero su ficha y Favoritos la siguen trayendo como no disponible", async () => {
        h = await makeHarness();
        await h.reset();
        const shown = await h.seed({ status: "active", draft: { title: "Casa visible" } });
        const paused = await h.seed({ status: "active", draft: { title: "Casa pausada" } });
        await h.owner("owner").setAvailable(paused.id, false);
        expect(await ids(filters())).toEqual([shown.publicId]);
        expect(await h.anon.getPublic(paused.publicId)).toMatchObject({ title: "Casa pausada", available: false });
        expect((await h.anon.getManyPublic([paused.publicId])).map((l) => l.available)).toEqual([false]);
        await h.owner("owner").setAvailable(paused.id, true);
        expect(await ids(filters())).toEqual([paused.publicId, shown.publicId]);
      }, 60_000);
    });
  });
}
