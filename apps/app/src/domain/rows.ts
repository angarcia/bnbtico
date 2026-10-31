// Mapeo tipado entre filas de la base y objetos del dominio, en un solo sitio.
// `acceptsNightly` se lee igual en las dos vistas (siempre true: check en la base) y nunca se escribe; `acceptsMonthly`
// es not null, y solo `true` cuenta como «Alquiler mensual».
import { holdFromRow } from "./admin-hold";
import type { CalendarDay } from "./calendar";
import type { Database, Json } from "./database.types";
import type { EditFieldColumn, EditItemState, EditLocation, EditPatch, EditPhoto, ListingEdit, LivePatch } from "./edit";
import { editOverview } from "./edit-label";
import { COLUMN_FIELD } from "./edit-summary";
import { photoSrcSet, variantPath } from "./image";
import { DEFAULT_PROVINCE, type Listing, type ListingDraft, type ListingStatus, type MonthlyMode, type Photo, type PublicListing } from "./listing";
import type { ZoneSource } from "./zones";
import type { BillingHouse, BillingOverview, PaymentSetupContext, ReminderDays, ReminderStatus, SubscriptionPlan } from "./subscription";

/** Sin `listing_is_public`: es una columna calculada (función SQL) que solo llega si se pide por nombre. */
export type ListingRow = Omit<Database["public"]["Tables"]["listings"]["Row"], "listing_is_public">;
export type ListingUpdate = Database["public"]["Tables"]["listings"]["Update"];
export type PhotoRow = Pick<Database["public"]["Tables"]["listing_photos"]["Row"], "id" | "path" | "position">;
export type PublicRow = Database["public"]["Views"]["listings_public"]["Row"];
type EditTableRow = Database["public"]["Tables"]["listing_edits"]["Row"];
type EditFieldRow = Pick<Database["public"]["Tables"]["listing_edit_fields"]["Row"], "field" | "status" | "review_note" | "submitted_at">;
export type EditPhotoRow = PhotoRow & Pick<Database["public"]["Tables"]["listing_edit_photos"]["Row"], "status" | "review_note" | "submitted_at">;
/** La edición pendiente tal como la embeben los adaptadores (listing_edits con el estado de cada dato y sus fotos nuevas). */
export type EditRow = Pick<EditTableRow, "status" | "title" | "kind" | "bathroom_shared" | "description" | "lat" | "lng" | "zone" | "zone_id" | "zone_source"> & {
  listing_edit_fields: EditFieldRow[];
  listing_edit_photos: EditPhotoRow[];
};
/** Lo que se pide de listing_edits para armar la edición. */
export const EDIT_SELECT =
  "status, title, kind, bathroom_shared, description, lat, lng, zone, zone_id, zone_source, listing_edit_fields(field, status, review_note, submitted_at), listing_edit_photos(id, path, position, status, review_note, submitted_at)";

export type PhotoUrl = (path: string) => string;

/** URL pública de un objeto del bucket `listings` de Storage. */
export const storagePhotoUrl =
  (supabaseUrl: string): PhotoUrl =>
  (path) =>
    `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/listings/${path}`;

const monthlyMode = (v: string | null): MonthlyMode | null => (v === "amount" || v === "contact" ? v : null);
const zoneSource = (v: string | null): ZoneSource | null => (v === "list" || v === "district" || v === "other" ? v : null);
const num = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);

export function toListingUpdate(d: Partial<ListingDraft>): ListingUpdate {
  const row: ListingUpdate = {};
  if ("kind" in d) row.kind = d.kind ?? null;
  if ("acceptsMonthly" in d) row.accepts_monthly = d.acceptsMonthly === true;
  if ("province" in d) row.province = d.province;
  if ("canton" in d) row.canton = d.canton;
  if ("district" in d) row.district = d.district || null;
  if ("zone" in d) row.zone = d.zone;
  if ("zoneId" in d) row.zone_id = d.zoneId ?? null;
  if ("zoneSource" in d) row.zone_source = d.zoneSource ?? null;
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

const itemState = (r: { status: string; review_note: string | null; submitted_at: string }): EditItemState => ({
  status: r.status === "changes" ? "changes" : "review",
  reviewNote: r.review_note ?? null,
  submittedAt: r.submitted_at,
});

/** null sin fila o con la fila vacía que devuelve PostgREST cuando save_edit borró la edición (todo null). */
export function fromEditRow(row: EditRow | null | undefined, url: PhotoUrl): ListingEdit | null {
  if (!row || (row.status as string | null) === null) return null;
  const source = zoneSource(row.zone_source);
  const location: EditLocation | null =
    row.lat !== null && row.lng !== null && source !== null ? { lat: row.lat, lng: row.lng, zone: row.zone ?? "", zoneId: row.zone_id ?? null, zoneSource: source } : null;
  const fields: ListingEdit["fields"] = {};
  for (const f of row.listing_edit_fields ?? []) fields[COLUMN_FIELD[f.field as EditFieldColumn]] = itemState(f);
  const states = new Map((row.listing_edit_photos ?? []).map((p) => [p.id, itemState(p)]));
  const photos: EditPhoto[] = fromPhotoRows(row.listing_edit_photos ?? [], url).map((p) => ({ ...p, ...states.get(p.id)! }));
  return {
    ...editOverview([...Object.values(fields), ...photos]),
    fields,
    title: row.title ?? null,
    kind: row.kind ?? null,
    bathroomShared: row.bathroom_shared ?? null,
    description: row.description ?? null,
    location,
    photos,
  };
}

/** Claves de update_listing_live (snake_case), solo las que trae el parche. */
export function toLivePatch(p: LivePatch): Record<string, Json> {
  const row: Record<string, Json> = {};
  if ("capacity" in p) row.capacity = num(p.capacity);
  if ("bedrooms" in p) row.bedrooms = num(p.bedrooms);
  if ("bathrooms" in p) row.bathrooms = num(p.bathrooms);
  if ("features" in p) row.features = [...(p.features ?? [])];
  if ("parkingPaid" in p) row.parking_paid = p.parkingPaid ?? null;
  if ("nightlyPriceCrc" in p) row.nightly_price_crc = num(p.nightlyPriceCrc);
  if ("acceptsMonthly" in p) row.accepts_monthly = p.acceptsMonthly === true;
  if ("monthlyPriceCrc" in p) row.monthly_price_crc = num(p.monthlyPriceCrc);
  return row;
}

/** Claves de save_edit (snake_case), solo las que trae el parche. */
export function toEditPatch(p: EditPatch): Record<string, Json> {
  const row: Record<string, Json> = {};
  if ("title" in p) row.title = p.title ?? null;
  if ("kind" in p) row.kind = p.kind ?? null;
  if ("bathroomShared" in p) row.bathroom_shared = p.bathroomShared ?? null;
  if ("description" in p) row.description = p.description ?? null;
  if ("lat" in p) row.lat = num(p.lat);
  if ("lng" in p) row.lng = num(p.lng);
  if ("zone" in p) row.zone = p.zone ?? null;
  if ("zoneId" in p) row.zone_id = p.zoneId ?? null;
  if ("zoneSource" in p) row.zone_source = p.zoneSource ?? null;
  return row;
}

export function fromListingRow(row: ListingRow, photoRows: readonly PhotoRow[], url: PhotoUrl, editRow?: EditRow | null): Listing {
  const photos = fromPhotoRows(photoRows, url);
  return {
    id: row.id,
    publicId: row.public_id,
    ownerId: row.owner_id,
    status: row.status,
    kind: row.kind ?? null,
    acceptsNightly: row.accepts_nightly === true,
    acceptsMonthly: row.accepts_monthly === true,
    province: row.province || DEFAULT_PROVINCE,
    canton: row.canton ?? "",
    district: row.district ?? "",
    zone: row.zone ?? "",
    zoneId: row.zone_id ?? null,
    zoneSource: zoneSource(row.zone_source),
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
    firstPublishedAt: row.first_published_at ?? null,
    // La edición pendiente: solo la embebe el adaptador del propietario; las demás lecturas no la piden.
    edit: fromEditRow(editRow, url),
    adminHold: holdFromRow(row.admin_hold, row.admin_hold_reason),
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

// ---------- Suscripción (fase 5): el JSON de owner_billing y payment_setup_context ----------

type JsonObject = Record<string, unknown>;
const obj = (v: unknown): JsonObject => (v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : {});
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function fromBillingHouse(v: unknown): BillingHouse {
  const h = obj(v);
  return {
    listingId: str(h.listing_id) ?? "",
    publicId: str(h.public_id) ?? "",
    title: str(h.title) ?? "",
    status: (str(h.status) ?? "draft") as ListingStatus,
    plan: (h.plan === "paid" ? "paid" : "promo") as SubscriptionPlan,
    promoSlot: int(h.promo_slot),
    promoMonths: int(h.promo_months),
    promoEndsOn: str(h.promo_ends_on),
    paidSince: str(h.paid_since),
    stoppedOn: str(h.stopped_on),
    monthlyPriceCrc: int(h.monthly_price_crc) ?? 0,
    hold: h.admin_hold === "paused" ? "paused" : h.admin_hold === "blocked" ? "blocked" : null,
    reminders: (Array.isArray(h.reminders) ? h.reminders : []).map((r) => {
      const x = obj(r);
      return { daysBefore: (int(x.days_before) ?? 0) as ReminderDays, status: (str(x.status) ?? "queued") as ReminderStatus, sentAt: str(x.sent_at) };
    }),
  };
}

/** La respuesta de la RPC owner_billing. */
export function fromBillingJson(json: Json | unknown): BillingOverview {
  const o = obj(json);
  const m = o.method ? obj(o.method) : null;
  return {
    houses: (Array.isArray(o.houses) ? o.houses : []).map(fromBillingHouse),
    method: m ? { brand: str(m.brand) ?? "", last4: str(m.last4) ?? "", expMonth: int(m.exp_month) ?? 0, expYear: int(m.exp_year) ?? 0, addedAt: str(m.added_at) ?? "" } : null,
    today: str(o.today) ?? "",
  };
}

/** La respuesta de la RPC payment_setup_context. */
export function fromSetupContextJson(json: Json | unknown): PaymentSetupContext {
  const o = obj(json);
  return { ownerId: str(o.owner_id) ?? "", fullName: str(o.full_name) ?? "", phone: str(o.phone) ?? "", customerRef: str(o.customer_ref) };
}
