// Fake en memoria de ListingsApi. Aplica las reglas de la base que cubre la suite de contrato.
import type { PublicListingsApi } from "../../domain/api";
import { calendarWindow } from "../../domain/calendar";
import { FX_INITIAL } from "../../domain/fx";
import { DomainError } from "../../domain/errors";
import { ALL_PROVINCES, stayRange, type Filters } from "../../domain/filters";
import { distanceMeters } from "../../domain/geo";
import { PROVINCES, type LinkState, type PublicListing, type SearchListing } from "../../domain/listing";
import { addDays } from "../../domain/dates";
import { stayEstimate, stayNights } from "../../domain/stay-price";
import { publicPhoto, storagePhotoUrl } from "../../domain/rows";
import { ZONE_RADIUS_M, caribeFirst, type Zone, type ZoneWithListings } from "../../domain/zones";
import { offerTaken } from "./billing";
import { approxPoint, isPublicListing, type FakeDb, type FakeListing } from "./db";
import { FAKE_ZONES, fakeCantonOf } from "./places";

export const SEARCH_LIMIT = 60;
export const SITEMAP_LIMIT = 1000;

export function createFakeListings(db: FakeDb, opts: { supabaseUrl: string }): PublicListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const active = () => [...db.listings.values()].filter(isPublicListing);

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
      ownerName: owner?.fullName || "Anfitrión",
      ownerWhatsappVerified: owner?.phoneVerified === true,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      photos: db.photosOf(l.id).map((p) => publicPhoto(p.path, url)),
    };
  }

  function linkState(publicId: string): LinkState {
    const l = db.byPublicId(publicId);
    if (!l || l.deletedAt !== null) return null;
    if (isPublicListing(l)) return "active";
    if (l.status === "draft" && l.reviewedAt === null) return null;
    return "blocked";
  }

  // Como search_listings: la zona elegida o el punto real a 5 km o menos del de la zona.
  const nearZone = (l: FakeListing, z: Zone) =>
    l.zoneId === z.id || (l.lat !== null && l.lng !== null && distanceMeters({ lat: l.lat, lng: l.lng }, z) <= ZONE_RADIUS_M);
  // Alguna noche de [from, to) ocupada en el calendario del fake.
  const busy = (l: FakeListing, from: string, to: string) => (db.days.get(l.id) ?? []).some((d) => !d.available && d.day >= from && d.day < to);

  // El total orientativo de [from, to) con la regla del dominio; search_listings la repite en SQL (search_stay_total).
  const stayTotal = (l: FakeListing, from: string, to: string): number | null =>
    stayEstimate({ nights: stayNights(from, to), days: db.days.get(l.id) ?? [], base: l.nightlyPriceCrc, acceptsMonthly: l.acceptsMonthly === true, monthlyCrc: l.monthlyPriceCrc })?.totalCrc ?? null;

  // Comparaciones con null fallan, como en SQL: una casa solo mensual no entra en un filtro de precio por noche.
  const gte = (v: number | null, min: number) => v !== null && v >= min;
  const lte = (v: number | null, max: number) => v !== null && v <= max;

  return {
    async searchPublic(q: Filters) {
      const r = stayRange(q);
      const today = db.today();
      if (r && (r.to <= r.from || r.from < today || r.to > addDays(today, 366))) throw new DomainError("Revise las fechas.", "validation");
      const zone = q.zone ? FAKE_ZONES.find((z) => z.id === q.zone) : null;
      if (q.zone && !zone) return [];
      return active()
        .filter((l) => l.available)
        .filter((l) => !zone || nearZone(l, zone))
        .filter((l) => !r || !busy(l, r.from, r.to))
        .filter((l) => !!zone || q.prov === ALL_PROVINCES || l.province === q.prov)
        .filter((l) => !q.ppl || gte(l.capacity, q.ppl))
        .filter((l) => !q.beds || gte(l.bedrooms, q.beds))
        .filter((l) => q.features.every((x) => l.features.includes(x)))
        .filter((l) => !q.min || gte(l.nightlyPriceCrc, q.min))
        .filter((l) => !q.max || lte(l.nightlyPriceCrc, q.max))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, SEARCH_LIMIT)
        // Como search_listings: el total, solo de las casas que se devuelven.
        .map((l): SearchListing => ({ ...toPublic(l), stayTotalCrc: r ? stayTotal(l, r.from, r.to) : null }));
    },

    async zonesWithListings() {
      const open = active().filter((l) => l.available && l.lat !== null);
      const zones = FAKE_ZONES.flatMap((z): ZoneWithListings[] => {
        const n = open.filter((l) => nearZone(l, z)).length;
        const place = fakeCantonOf(z.cantonCode);
        return n > 0 && place ? [{ ...z, ...place, listings: n }] : [];
      });
      return caribeFirst(zones.sort((a, b) => a.name.localeCompare(b.name, "es")));
    },

    async getPublic(publicId) {
      const l = db.byPublicId(publicId);
      return l && isPublicListing(l) ? toPublic(l) : null;
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
      if (!l || !isPublicListing(l)) return [];
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
      const house = db.byPublicId(publicId)!;
      if (house.adminHold) return "other";
      const status = house.status;
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
