// Consultas de casas. Todas reciben el cliente de Supabase del usuario (RLS decide qué ve y qué toca).
// Devuelven objetos del dominio (schema.ts), nunca filas crudas.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Result } from "@/lib/auth/types";
import { PHOTO_BUCKET, photoUrl } from "@/lib/supabase/storage";
import { DEFAULT_PROVINCE, normalize, type Listing, type ListingDraft, type Photo } from "./schema";

type Row = Record<string, unknown>;

const LISTING_COLUMNS =
  "id, public_id, owner_id, status, kind, title, description, province, canton, zone, lat, lng, capacity, bedrooms, bathrooms, features, parking_paid, nightly_price_crc, min_nights, accepts_monthly, monthly_mode, monthly_price_crc, min_months, whatsapp_phone, available, review_note, created_at, updated_at, listing_photos(id, path, position)";

/** Centinela de los `not null` del esquema mientras el borrador no tiene valor real. */
const PLACEHOLDER = 1;

export function toRow(d: Partial<ListingDraft>): Row {
  const row: Row = {};
  const num = (v: number | null | undefined, fallback: number) => (v === null || v === undefined || Number.isNaN(v) ? fallback : v);
  if ("kind" in d) row.kind = d.kind;
  if ("acceptsMonthly" in d) row.accepts_monthly = d.acceptsMonthly === true;
  if ("province" in d) row.province = d.province;
  if ("canton" in d) row.canton = d.canton;
  if ("zone" in d) row.zone = d.zone;
  if ("lat" in d) row.lat = d.lat;
  if ("lng" in d) row.lng = d.lng;
  if ("capacity" in d) row.capacity = num(d.capacity, PLACEHOLDER);
  if ("bedrooms" in d) row.bedrooms = num(d.bedrooms, PLACEHOLDER);
  if ("bathrooms" in d) row.bathrooms = num(d.bathrooms, PLACEHOLDER);
  if ("title" in d) row.title = d.title;
  if ("description" in d) row.description = d.description;
  if ("features" in d) row.features = d.features;
  if ("parkingPaid" in d) row.parking_paid = d.parkingPaid;
  if ("nightlyPriceCrc" in d) row.nightly_price_crc = num(d.nightlyPriceCrc, PLACEHOLDER);
  if ("minNights" in d) row.min_nights = num(d.minNights, PLACEHOLDER);
  if ("monthlyMode" in d) row.monthly_mode = d.monthlyMode;
  if ("monthlyPriceCrc" in d) row.monthly_price_crc = num(d.monthlyPriceCrc, null as unknown as number);
  if ("minMonths" in d) row.min_months = num(d.minMonths, null as unknown as number);
  return row;
}

export function fromRow(row: Row): Listing {
  const photos = ((row.listing_photos as Row[] | undefined) ?? [])
    .map((p) => ({ id: String(p.id), path: String(p.path), position: Number(p.position), url: photoUrl(String(p.path)) }))
    .sort((a, b) => a.position - b.position);
  const untouched = row.title === "";
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    ownerId: String(row.owner_id),
    status: row.status as Listing["status"],
    kind: (row.kind as Listing["kind"]) ?? null,
    acceptsMonthly: row.accepts_monthly === true ? true : untouched ? null : false,
    province: String(row.province ?? DEFAULT_PROVINCE),
    canton: String(row.canton ?? ""),
    zone: String(row.zone ?? ""),
    lat: n(row.lat),
    lng: n(row.lng),
    // Hasta que el dueño pasa por Detalles, los centinelas del esquema se muestran vacíos.
    capacity: untouched && row.capacity === PLACEHOLDER ? null : n(row.capacity),
    bedrooms: untouched && row.bedrooms === PLACEHOLDER ? null : n(row.bedrooms),
    bathrooms: untouched && row.bathrooms === PLACEHOLDER ? null : n(row.bathrooms),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    features: (row.features as Listing["features"]) ?? [],
    parkingPaid: (row.parking_paid as boolean | null) ?? null,
    photoCount: photos.length,
    nightlyPriceCrc: row.nightly_price_crc === PLACEHOLDER ? null : n(row.nightly_price_crc), // ningún precio real es ₡1
    minNights: n(row.min_nights),
    monthlyMode: (row.monthly_mode as Listing["monthlyMode"]) ?? null,
    monthlyPriceCrc: n(row.monthly_price_crc),
    minMonths: n(row.min_months),
    available: row.available !== false,
    reviewNote: (row.review_note as string | null) ?? null,
    whatsappPhone: String(row.whatsapp_phone ?? ""),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    photos,
  };
}

const fail = (message: string | undefined, fallback: string): Result => ({ ok: false, error: message && /[áéíóúñ¿¡]|\./.test(message) ? message : fallback });

export async function createDraft(db: SupabaseClient, ownerId: string, ownerPhone: string): Promise<{ id: string; publicId: string }> {
  const { data, error } = await db
    .from("listings")
    .insert({ owner_id: ownerId, status: "draft", title: "", description: "", province: DEFAULT_PROVINCE, capacity: PLACEHOLDER, bedrooms: PLACEHOLDER, bathrooms: PLACEHOLDER, nightly_price_crc: PLACEHOLDER, whatsapp_phone: ownerPhone })
    .select("id, public_id")
    .single();
  if (error) throw error;
  return { id: String(data.id), publicId: String(data.public_id) };
}

export async function getOwnListing(db: SupabaseClient, id: string): Promise<Listing | null> {
  const { data } = await db.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();
  return data ? fromRow(data as Row) : null;
}

export async function listOwnListings(db: SupabaseClient): Promise<Listing[]> {
  const { data: user } = await db.auth.getUser();
  if (!user.user) return [];
  const { data } = await db.from("listings").select(LISTING_COLUMNS).eq("owner_id", user.user.id).order("created_at", { ascending: false });
  return ((data as Row[] | null) ?? []).map(fromRow);
}

export async function findResumableDraft(db: SupabaseClient): Promise<Listing | null> {
  const { data: user } = await db.auth.getUser();
  if (!user.user) return null;
  const { data } = await db.from("listings").select(LISTING_COLUMNS).eq("owner_id", user.user.id).eq("status", "draft").is("reviewed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? fromRow(data as Row) : null;
}

/** Guarda un paso: mezcla el parche sobre el borrador actual, normaliza y escribe solo las columnas afectadas. */
export async function saveStep(db: SupabaseClient, listing: Listing, patch: Partial<ListingDraft>): Promise<void> {
  const merged = normalize({ ...listing, ...patch });
  const touched: Partial<ListingDraft> = { ...patch };
  for (const key of ["parkingPaid", "monthlyMode", "monthlyPriceCrc", "minMonths"] as const) {
    if (merged[key] !== listing[key]) (touched as Record<string, unknown>)[key] = merged[key];
  }
  const row = toRow(touched);
  if (Object.keys(row).length === 0) return;
  const { error } = await db.from("listings").update(row).eq("id", listing.id);
  if (error) throw error;
}

export async function deleteDraft(db: SupabaseClient, id: string): Promise<Result> {
  const { data, error } = await db.from("listings").delete().eq("id", id).eq("status", "draft").select("id");
  if (error) return fail(error.message, "No pudimos descartar el borrador.");
  return data && data.length > 0 ? { ok: true } : { ok: false, error: "Solo se pueden descartar borradores." };
}

/** Envía a revisión (RPC submit_listing: valida en la base lo mismo que la UI). */
export async function submit(db: SupabaseClient, id: string): Promise<Result> {
  const { error } = await db.rpc("submit_listing", { p_listing: id });
  return error ? fail(error.message, "No pudimos enviar el anuncio. Intentá de nuevo.") : { ok: true };
}

// ---------- Fotos ----------
const toPhoto = (p: Row): Photo => ({ id: String(p.id), path: String(p.path), position: Number(p.position), url: photoUrl(String(p.path)) });

export async function listPhotos(db: SupabaseClient, listingId: string): Promise<Photo[]> {
  const { data } = await db.from("listing_photos").select("id, path, position").eq("listing_id", listingId).order("position");
  return ((data as Row[] | null) ?? []).map(toPhoto);
}

/** Registra una foto ya subida a Storage, al final de la lista. */
export async function addPhoto(db: SupabaseClient, listingId: string, path: string): Promise<Photo> {
  const current = await listPhotos(db, listingId);
  const { data, error } = await db.from("listing_photos").insert({ listing_id: listingId, path, position: current.length }).select("id, path, position").single();
  if (error) throw error;
  return toPhoto(data as Row);
}

/** Borra el objeto de Storage y la fila, y recompacta las posiciones. */
export async function removePhoto(db: SupabaseClient, listingId: string, photoId: string): Promise<Result> {
  const photos = await listPhotos(db, listingId);
  const photo = photos.find((p) => p.id === photoId);
  if (!photo) return { ok: false, error: "Esa foto ya no existe." };
  const { error } = await db.from("listing_photos").delete().eq("id", photoId);
  if (error) return fail(error.message, "No pudimos quitar la foto.");
  await db.storage.from(PHOTO_BUCKET).remove([photo.path]);
  await reorder(db, photos.filter((p) => p.id !== photoId));
  return { ok: true };
}

/** La foto elegida pasa a la posición 0 (portada); el resto conserva su orden. */
export async function setCover(db: SupabaseClient, listingId: string, photoId: string): Promise<Result> {
  const photos = await listPhotos(db, listingId);
  const photo = photos.find((p) => p.id === photoId);
  if (!photo) return { ok: false, error: "Esa foto ya no existe." };
  await reorder(db, [photo, ...photos.filter((p) => p.id !== photoId)]);
  return { ok: true };
}

async function reorder(db: SupabaseClient, ordered: Photo[]) {
  // Dos pasadas para no chocar entre posiciones intermedias (no hay unique, pero deja el orden determinista).
  for (const [i, p] of ordered.entries()) if (p.position !== i) await db.from("listing_photos").update({ position: i }).eq("id", p.id);
}

export type { Photo };
