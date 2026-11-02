// Contrato de las lecturas públicas: catálogo con filtros, ficha, estado del enlace y provincias con casas.
import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "../../src/domain/dates";
import { DomainError } from "../../src/domain/errors";
import { parseFilters, type Filters } from "../../src/domain/filters";
import { costaRicaToday } from "../../src/domain/inquiry";
import { PROVINCES } from "../../src/domain/listing";
import { APPROX_MAX_METERS, APPROX_MIN_METERS, distanceMeters } from "../../src/domain/geo";
import type { ListingsHarness, Seeded } from "./harness";
import { PUERTO_VIEJO } from "./points";

const filters = (params: Record<string, string> = {}): Filters => parseFilters({ prov: "Todas", ...params }, PROVINCES);

export function publicReadsContract(name: string, makeHarness: () => Promise<ListingsHarness>) {
  describe(`lecturas públicas · ${name}`, () => {
    let h: ListingsHarness;
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

      it("alquiler mensual", async () => {
        expect(await ids(filters({ mensual: "1" }))).toEqual([grande.publicId, mensual.publicId]);
        // Enlaces viejos: modo=monthly es el mensual; nightly y both ya no filtran.
        expect(await ids(filters({ modo: "monthly" }))).toEqual([grande.publicId, mensual.publicId]);
        expect(await ids(filters({ modo: "both" }))).toEqual(await ids(filters()));
        expect(await ids(filters({ modo: "nightly" }))).toEqual(await ids(filters()));
        // Con el mensual no se aplica el rango por noche (mensual: 38 000 la noche; grande: 150 000).
        expect(await ids(filters({ mensual: "1", min: "50000", max: "100000" }))).toEqual([grande.publicId, mensual.publicId]);
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
        await h.setClosed(pv.id, true);
        expect((await h.anon.zonesWithListings()).map((z) => z.id)).not.toContain("704-cocles");
        await h.setClosed(pv.id, false);
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
        await h.setClosed(paused.id, true);
        expect(await ids(filters())).toEqual([shown.publicId]);
        expect(await h.anon.getPublic(paused.publicId)).toMatchObject({ title: "Casa pausada", available: false });
        expect((await h.anon.getManyPublic([paused.publicId])).map((l) => l.available)).toEqual([false]);
        await h.setClosed(paused.id, false);
        expect(await ids(filters())).toEqual([paused.publicId, shown.publicId]);
      }, 60_000);
    });
  });
}
