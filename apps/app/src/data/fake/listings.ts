// Fake en memoria de ListingsApi. Aplica las reglas de la base que cubre la suite de contrato.
import type { PublicListingsApi } from "../../domain/api";
import { calendarWindow } from "../../domain/calendar";
import { FX_INITIAL } from "../../domain/fx";
import { ALL_PROVINCES, effectiveFilters, type Filters } from "../../domain/filters";
import { PROVINCES, type LinkState, type PublicListing } from "../../domain/listing";
import { publicPhoto, storagePhotoUrl } from "../../domain/rows";
import { offerTaken } from "./billing";
import { approxPoint, type FakeDb, type FakeListing } from "./db";

export const SEARCH_LIMIT = 60;
export const SITEMAP_LIMIT = 1000;

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
      reopenAt: l.reopenAt,
      ownerName: owner?.fullName || "Propietario",
      ownerWhatsappVerified: owner?.phoneVerified === true,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      photos: db.photosOf(l.id).map((p) => publicPhoto(p.path, url)),
    };
  }

  function linkState(publicId: string): LinkState {
    const l = db.byPublicId(publicId);
    if (!l) return null;
    if (l.status === "active") return "active";
    if (l.status === "draft" && l.reviewedAt === null) return null;
    return "blocked";
  }

  // Comparaciones con null fallan, como en SQL: una casa solo mensual no entra en un filtro de precio por noche.
  const gte = (v: number | null, min: number) => v !== null && v >= min;
  const lte = (v: number | null, max: number) => v !== null && v <= max;

  return {
    async searchPublic(f: Filters) {
      const q = effectiveFilters(f); // con el mensual no se aplica el rango por noche
      return active()
        .filter((l) => l.available)
        .filter((l) => q.prov === ALL_PROVINCES || l.province === q.prov)
        .filter((l) => !q.monthly || l.acceptsMonthly === true)
        .filter((l) => !q.ppl || gte(l.capacity, q.ppl))
        .filter((l) => !q.beds || gte(l.bedrooms, q.beds))
        .filter((l) => q.features.every((x) => l.features.includes(x)))
        .filter((l) => !q.min || gte(l.nightlyPriceCrc, q.min))
        .filter((l) => !q.max || lte(l.nightlyPriceCrc, q.max))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, SEARCH_LIMIT)
        .map(toPublic);
    },

    async getPublic(publicId) {
      const l = db.byPublicId(publicId);
      return l && l.status === "active" ? toPublic(l) : null;
    },

    async getManyPublic(publicIds) {
      const wanted = new Set(publicIds);
      return active().filter((l) => wanted.has(l.publicId)).map(toPublic);
    },

    async linkState(publicId) {
      return linkState(publicId);
    },

    async provincesWithListings() {
      const found = new Set(active().map((l) => l.province));
      return PROVINCES.filter((p) => found.has(p));
    },

    async countActive() {
      return active().length;
    },

    async getPublicDays(publicId) {
      const l = db.byPublicId(publicId);
      if (!l || l.status !== "active") return [];
      const { first, last } = calendarWindow(db.today());
      return (db.days.get(l.id) ?? []).filter((d) => d.day >= first && d.day <= last).map((d) => ({ ...d }));
    },

    async fxRate() {
      const latest = [...db.fxRates.values()].sort((a, b) => b.day.localeCompare(a.day))[0];
      return latest ? { ...latest } : { ...FX_INITIAL };
    },

    async offerTaken() {
      return offerTaken(db);
    },

    async blockedReason(publicId) {
      if (linkState(publicId) !== "blocked") return null;
      const status = db.byPublicId(publicId)!.status;
      return status === "inactive" ? "stopped" : status === "payment_due" ? "payment" : "other";
    },

    async sitemap() {
      return active()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, SITEMAP_LIMIT)
        .map((l) => ({ publicId: l.publicId, updatedAt: l.updatedAt }));
    },
  };
}
