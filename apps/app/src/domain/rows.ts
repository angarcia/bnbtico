// Mapeo tipado entre filas de la base y objetos del dominio, en un solo sitio.
// `acceptsNightly` se lee igual en las dos vistas: la columna es not null, y solo `true` cuenta como vacacional.
import type { CalendarDay } from "./calendar";
import type { Database, Json } from "./database.types";
import { photoSrcSet, variantPath } from "./image";
import { DEFAULT_PROVINCE, type Listing, type ListingDraft, type MonthlyMode, type Photo, type PublicListing } from "./listing";

/** Sin `listing_is_public`: es una columna calculada (función SQL) que solo llega si se pide por nombre. */
export type ListingRow = Omit<Database["public"]["Tables"]["listings"]["Row"], "listing_is_public">;
export type ListingUpdate = Database["public"]["Tables"]["listings"]["Update"];
export type PhotoRow = Pick<Database["public"]["Tables"]["listing_photos"]["Row"], "id" | "path" | "position">;
export type PublicRow = Database["public"]["Views"]["listings_public"]["Row"];

export type PhotoUrl = (path: string) => string;

/** URL pública de un objeto del bucket `listings` de Storage. */
export const storagePhotoUrl =
  (supabaseUrl: string): PhotoUrl =>
  (path) =>
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/listings/${path}`;

const monthlyMode = (v: string | null): MonthlyMode | null => (v === "amount" || v === "contact" ? v : null);
const num = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);

export function toListingUpdate(d: Partial<ListingDraft>): ListingUpdate {
  const row: ListingUpdate = {};
  if ("kind" in d) row.kind = d.kind ?? null;
  if ("acceptsNightly" in d) row.accepts_nightly = d.acceptsNightly === true;
  if ("acceptsMonthly" in d) row.accepts_monthly = d.acceptsMonthly ?? null;
  if ("province" in d) row.province = d.province;
  if ("canton" in d) row.canton = d.canton;
  if ("zone" in d) row.zone = d.zone;
  if ("lat" in d) row.lat = num(d.lat);
  if ("lng" in d) row.lng = num(d.lng);
  if ("capacity" in d) row.capacity = num(d.capacity);
  if ("bedrooms" in d) row.bedrooms = num(d.bedrooms);
  if ("bathrooms" in d) row.bathrooms = num(d.bathrooms);
  if ("bathroomShared" in d) row.bathroom_shared = d.bathroomShared ?? null;
  if ("title" in d) row.title = d.title;
  if ("description" in d) row.description = d.description;
  if ("features" in d) row.features = d.features;
  if ("parkingPaid" in d) row.parking_paid = d.parkingPaid ?? null;
  if ("nightlyPriceCrc" in d) row.nightly_price_crc = num(d.nightlyPriceCrc);
  if ("minNights" in d) row.min_nights = num(d.minNights);
  if ("monthlyMode" in d) row.monthly_mode = d.monthlyMode ?? null;
  if ("monthlyPriceCrc" in d) row.monthly_price_crc = num(d.monthlyPriceCrc);
  if ("minMonths" in d) row.min_months = num(d.minMonths);
  return row;
}

export function fromPhotoRows(rows: readonly PhotoRow[], url: PhotoUrl): Photo[] {
  return rows.map((p) => ({ id: p.id, path: p.path, position: p.position, url: url(variantPath(p.path, 800)) })).sort((a, b) => a.position - b.position);
}

export function fromListingRow(row: ListingRow, photoRows: readonly PhotoRow[], url: PhotoUrl): Listing {
  const photos = fromPhotoRows(photoRows, url);
  return {
    id: row.id,
    publicId: row.public_id,
    ownerId: row.owner_id,
    status: row.status,
    kind: row.kind ?? null,
    acceptsNightly: row.accepts_nightly === true,
    acceptsMonthly: row.accepts_monthly ?? null,
    province: row.province || DEFAULT_PROVINCE,
    canton: row.canton ?? "",
    zone: row.zone ?? "",
    lat: num(row.lat),
    lng: num(row.lng),
    capacity: num(row.capacity),
    bedrooms: num(row.bedrooms),
    bathrooms: num(row.bathrooms),
    bathroomShared: row.bathroom_shared ?? null,
    title: row.title ?? "",
    description: row.description ?? "",
    features: row.features ?? [],
    parkingPaid: row.parking_paid ?? null,
    photoCount: photos.length,
    nightlyPriceCrc: num(row.nightly_price_crc),
    minNights: num(row.min_nights),
    monthlyMode: monthlyMode(row.monthly_mode),
    monthlyPriceCrc: num(row.monthly_price_crc),
    minMonths: num(row.min_months),
    available: row.available !== false,
    reopenAt: row.reopen_at ?? null,
    reviewNote: row.review_note ?? null,
    reviewedAt: row.reviewed_at ?? null,
    whatsappPhone: row.whatsapp_phone ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos,
  };
}

export const publicPhoto = (path: string, url: PhotoUrl) => ({ path, url: url(variantPath(path, 800)), srcSet: photoSrcSet(path, url) });

const photoPaths = (value: Json | null): string[] => (Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : []);

export function fromPublicRow(row: PublicRow, url: PhotoUrl): PublicListing {
  return {
    id: row.id ?? "",
    publicId: row.public_id ?? "",
    kind: row.kind ?? "completo",
    title: row.title ?? "",
    description: row.description ?? "",
    province: row.province ?? "",
    canton: row.canton ?? "",
    zone: row.zone ?? "",
    approx: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
    capacity: row.capacity ?? 0,
    bedrooms: row.bedrooms ?? 0,
    bathrooms: row.bathrooms ?? 0,
    bathroomShared: row.bathroom_shared ?? null,
    features: row.features ?? [],
    parkingPaid: row.parking_paid ?? null,
    acceptsNightly: row.accepts_nightly === true,
    nightlyPriceCrc: num(row.nightly_price_crc),
    minNights: num(row.min_nights),
    acceptsMonthly: row.accepts_monthly === true,
    monthlyMode: monthlyMode(row.monthly_mode),
    monthlyPriceCrc: num(row.monthly_price_crc),
    minMonths: num(row.min_months),
    available: row.available !== false,
    reopenAt: row.reopen_at ?? null,
    ownerName: row.owner_name || "Propietario",
    ownerWhatsappVerified: row.owner_whatsapp_verified === true,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
    photos: photoPaths(row.photos).map((path) => publicPhoto(path, url)),
  };
}


/** Una fila de listing_days (o de public_listing_days). */
export const fromDayRow = (r: { day: string; available: boolean; special_price_crc: number | null }): CalendarDay => ({
  day: r.day,
  available: r.available,
  specialPriceCrc: r.special_price_crc,
});
