// Fake en memoria de ListingsApi. Aplica las reglas de la base que cubre la suite de contrato.
import type { PublicListingsApi } from "../../domain/api";
import { ALL_PROVINCES, type Filters } from "../../domain/filters";
import { PROVINCES, type LinkState, type PublicListing } from "../../domain/listing";
import { storagePhotoUrl } from "../../domain/rows";
import { approxPoint, type FakeDb, type FakeListing } from "./db";

export const SEARCH_LIMIT = 60;

export function createFakeListings(db: FakeDb, opts: { supabaseUrl: string }): PublicListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const active = () => [...db.listings.values()].filter((l) => l.status === "active");

  function toPublic(l: FakeListing): PublicListing {
    const owner = db.profiles.get(l.ownerId);
    return {
      id: l.id,
      publicId: l.publicId,
      kind: l.kind ?? "completo",
      title: l.title,
      description: l.description,
      province: l.province,
      canton: l.canton,
      zone: l.zone,
      approx: l.lat !== null && l.lng !== null ? approxPoint(l.lat, l.lng, l.publicId) : null,
      capacity: l.capacity ?? 0,
      bedrooms: l.bedrooms ?? 0,
      bathrooms: l.bathrooms ?? 0,
      bathroomShared: l.bathroomShared,
      features: [...l.features],
      parkingPaid: l.parkingPaid,
      acceptsNightly: l.acceptsNightly,
      nightlyPriceCrc: l.nightlyPriceCrc,
      minNights: l.minNights,
      acceptsMonthly: l.acceptsMonthly === true,
      monthlyMode: l.monthlyMode,
      monthlyPriceCrc: l.monthlyPriceCrc,
      minMonths: l.minMonths,
      available: l.available,
      ownerName: owner?.fullName || "Propietario",
      ownerWhatsappVerified: owner?.phoneVerified === true,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      photos: db.photosOf(l.id).map((p) => ({ path: p.path, url: url(p.path) })),
    };
  }

  // Comparaciones con null fallan, como en SQL: una casa solo mensual no entra en un filtro de precio por noche.
  const gte = (v: number | null, min: number) => v !== null && v >= min;
  const lte = (v: number | null, max: number) => v !== null && v <= max;

  return {
    async searchPublic(f: Filters) {
      return active()
        .filter((l) => f.prov === ALL_PROVINCES || l.province === f.prov)
        .filter((l) => (f.mode === "nightly" ? l.acceptsNightly : f.mode === "monthly" ? l.acceptsMonthly === true : true))
        .filter((l) => !f.ppl || gte(l.capacity, f.ppl))
        .filter((l) => !f.beds || gte(l.bedrooms, f.beds))
        .filter((l) => f.features.every((x) => l.features.includes(x)))
        .filter((l) => !f.min || gte(l.nightlyPriceCrc, f.min))
        .filter((l) => !f.max || lte(l.nightlyPriceCrc, f.max))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, SEARCH_LIMIT)
        .map(toPublic);
    },

    async getPublic(publicId) {
      const l = db.byPublicId(publicId);
      return l && l.status === "active" ? toPublic(l) : null;
    },

    async linkState(publicId): Promise<LinkState> {
      const l = db.byPublicId(publicId);
      if (!l) return null;
      if (l.status === "active") return "active";
      if (l.status === "draft" && l.reviewedAt === null) return null;
      return "blocked";
    },

    async provincesWithListings() {
      const found = new Set(active().map((l) => l.province));
      return PROVINCES.filter((p) => found.has(p));
    },
  };
}
