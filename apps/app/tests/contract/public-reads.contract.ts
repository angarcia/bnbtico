// Contrato de las lecturas públicas: catálogo con filtros, ficha, estado del enlace y provincias con casas.
import { beforeAll, describe, expect, it } from "vitest";
import { parseFilters, type Filters } from "../../src/domain/filters";
import { PROVINCES } from "../../src/domain/listing";
import { APPROX_MAX_METERS, APPROX_MIN_METERS, distanceMeters } from "../../src/domain/geo";
import type { ListingsHarness, Seeded } from "./harness";

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
        active = await h.seed({ status: "active", photos: 6, draft: { title: "Casa Punta Uva", zone: "Punta Uva" } });
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
          draft: { acceptsNightly: false, acceptsMonthly: true, nightlyPriceCrc: null, monthlyPriceCrc: 480000, capacity: 4, bedrooms: 2, features: ["wifi", "pets"] },
        });
        grande = await h.seed({ status: "active", draft: { acceptsMonthly: true, monthlyPriceCrc: 900000, capacity: 8, bedrooms: 4, features: ["pool", "wifi", "parking"], parkingPaid: false, nightlyPriceCrc: 150000 } });
        nicoya = await h.seed({ status: "active", draft: { province: "Guanacaste", canton: "Nicoya", zone: "Sámara", lat: 9.88, lng: -85.53, nightlyPriceCrc: 60000 } });
      }, 60_000);

      it("más recientes primero", async () => {
        expect(await ids(filters())).toEqual([nicoya.publicId, grande.publicId, mensual.publicId, cahuita.publicId]);
      });

      it("provincia", async () => {
        expect(await ids(filters({ prov: "Guanacaste" }))).toEqual([nicoya.publicId]);
        expect(await ids(parseFilters({ prov: "Limón" }, ["Limón"]))).toEqual([grande.publicId, mensual.publicId, cahuita.publicId]);
      });

      it("modalidad", async () => {
        expect(await ids(filters({ modo: "monthly" }))).toEqual([grande.publicId, mensual.publicId]);
        expect(await ids(filters({ modo: "nightly" }))).toEqual([nicoya.publicId, grande.publicId, cahuita.publicId]);
      });

      it("personas y habitaciones como mínimo", async () => {
        expect(await ids(filters({ ppl: "4" }))).toEqual([grande.publicId, mensual.publicId]);
        expect(await ids(filters({ beds: "3" }))).toEqual([grande.publicId]);
      });

      it("características: todas las pedidas", async () => {
        expect(await ids(filters({ wifi: "1", pets: "1" }))).toEqual([mensual.publicId]);
        expect(await ids(filters({ pool: "1" }))).toEqual([grande.publicId]);
      });

      it("precio por noche: mínimo y máximo; las solo mensuales no entran", async () => {
        expect(await ids(filters({ min: "50000" }))).toEqual([nicoya.publicId, grande.publicId]);
        expect(await ids(filters({ max: "60000" }))).toEqual([nicoya.publicId, cahuita.publicId]);
        expect(await ids(filters({ min: "45000", max: "100000" }))).toEqual([nicoya.publicId]);
      });

      it("provincias con casas activas, en el orden de la lista", async () => {
        expect(await h.anon.provincesWithListings()).toEqual(["Guanacaste", "Limón"]);
      });
    });
  });
}
