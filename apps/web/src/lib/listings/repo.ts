// Consultas de casas. Todas reciben el cliente de Supabase del usuario (RLS decide qué ve y qué toca).
// Devuelven objetos del dominio (schema.ts), nunca filas crudas.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Result } from "@/lib/auth/types";
import { PHOTO_BUCKET, photoUrl } from "@/lib/supabase/storage";
import { ALL_PROVINCES, type Filters } from "./filters";
import { DEFAULT_PROVINCE, normalize, type Feature, type Kind, type Listing, type ListingDraft, type MonthlyMode, type Photo } from "./schema";

type Row = Record<string, unknown>;

const LISTING_COLUMNS =
  "id, public_id, owner_id, status, kind, title, description, province, canton, zone, lat, lng, capacity, bedrooms, bathrooms, bathroom_shared, features, parking_paid, accepts_nightly, nightly_price_crc, min_nights, accepts_monthly, monthly_mode, monthly_price_crc, min_months, whatsapp_phone, available, review_note, reviewed_at, created_at, updated_at, listing_photos(id, path, position)";

export function toRow(d: Partial<ListingDraft>): Row {
  const row: Row = {};
  // Vacío o inválido se guarda como null (la validación por paso ya impidió llegar aquí con NaN).
  const num = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);
  if ("kind" in d) row.kind = d.kind;
  if ("acceptsNightly" in d) row.accepts_nightly = d.acceptsNightly === true;
  if ("acceptsMonthly" in d) row.accepts_monthly = d.acceptsMonthly;
  if ("province" in d) row.province = d.province;
  if ("canton" in d) row.canton = d.canton;
  if ("zone" in d) row.zone = d.zone;
  if ("lat" in d) row.lat = d.lat;
  if ("lng" in d) row.lng = d.lng;
  if ("capacity" in d) row.capacity = num(d.capacity);
  if ("bedrooms" in d) row.bedrooms = num(d.bedrooms);
  if ("bathrooms" in d) row.bathrooms = num(d.bathrooms);
  if ("bathroomShared" in d) row.bathroom_shared = d.bathroomShared;
  if ("title" in d) row.title = d.title;
  if ("description" in d) row.description = d.description;
  if ("features" in d) row.features = d.features;
  if ("parkingPaid" in d) row.parking_paid = d.parkingPaid;
  if ("nightlyPriceCrc" in d) row.nightly_price_crc = num(d.nightlyPriceCrc);
  if ("minNights" in d) row.min_nights = num(d.minNights);
  if ("monthlyMode" in d) row.monthly_mode = d.monthlyMode;
  if ("monthlyPriceCrc" in d) row.monthly_price_crc = num(d.monthlyPriceCrc);
  if ("minMonths" in d) row.min_months = num(d.minMonths);
  return row;
}

export function fromRow(row: Row): Listing {
  const photos = ((row.listing_photos as Row[] | undefined) ?? [])
    .map((p) => ({ id: String(p.id), path: String(p.path), position: Number(p.position), url: photoUrl(String(p.path)) }))
    .sort((a, b) => a.position - b.position);
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(row.id),
    publicId: String(row.public_id),
    ownerId: String(row.owner_id),
    status: row.status as Listing["status"],
    kind: (row.kind as Listing["kind"]) ?? null,
    acceptsNightly: row.accepts_nightly === true,
    acceptsMonthly: row.accepts_monthly === null || row.accepts_monthly === undefined ? null : row.accepts_monthly === true,
    province: String(row.province ?? DEFAULT_PROVINCE),
    canton: String(row.canton ?? ""),
    zone: String(row.zone ?? ""),
    lat: n(row.lat),
    lng: n(row.lng),
    capacity: n(row.capacity),
    bedrooms: n(row.bedrooms),
    bathrooms: n(row.bathrooms),
    bathroomShared: (row.bathroom_shared as boolean | null) ?? null,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    features: (row.features as Listing["features"]) ?? [],
    parkingPaid: (row.parking_paid as boolean | null) ?? null,
    photoCount: photos.length,
    nightlyPriceCrc: n(row.nightly_price_crc),
    minNights: n(row.min_nights),
    monthlyMode: (row.monthly_mode as Listing["monthlyMode"]) ?? null,
    monthlyPriceCrc: n(row.monthly_price_crc),
    minMonths: n(row.min_months),
    available: row.available !== false,
    reviewNote: (row.review_note as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
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
    .insert({ owner_id: ownerId, status: "draft", title: "", description: "", province: DEFAULT_PROVINCE, whatsapp_phone: ownerPhone, accepts_nightly: false })
    .select("id, public_id")
    .single();
  if (error) throw error;
  return { id: String(data.id), publicId: String(data.public_id) };
}

/** Solo las del propietario con sesión (la RLS también deja leer a un admin; aquí no basta con que exista). */
export async function getOwnListing(db: SupabaseClient, id: string): Promise<Listing | null> {
  const { data: user } = await db.auth.getUser();
  if (!user.user) return null;
  const { data } = await db.from("listings").select(LISTING_COLUMNS).eq("id", id).eq("owner_id", user.user.id).maybeSingle();
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
  return error ? fail(error.message, "No pudimos enviar el anuncio. Intente de nuevo.") : { ok: true };
}

// ---------- Público (vista listings_public, legible con la clave anónima) ----------
export interface PublicListing {
  publicId: string;
  kind: Kind;
  title: string;
  description: string;
  province: string;
  canton: string;
  zone: string;
  lat: number | null; // ya aproximados (~500 m), nunca el punto exacto
  lng: number | null;
  capacity: number;
  bedrooms: number;
  bathrooms: number;
  bathroomShared: boolean | null;
  features: Feature[];
  parkingPaid: boolean | null;
  acceptsNightly: boolean;
  nightlyPriceCrc: number | null;
  minNights: number | null;
  acceptsMonthly: boolean;
  monthlyMode: MonthlyMode | null;
  monthlyPriceCrc: number | null;
  minMonths: number | null;
  available: boolean;
  ownerName: string;
  ownerWhatsappVerified: boolean;
  createdAt: string;
  photos: Photo[];
}

const PUBLIC_COLUMNS =
  "id, public_id, kind, title, description, province, canton, zone, lat, lng, capacity, bedrooms, bathrooms, bathroom_shared, features, parking_paid, accepts_nightly, nightly_price_crc, min_nights, accepts_monthly, monthly_mode, monthly_price_crc, min_months, available, created_at, owner_name, owner_whatsapp_verified";

async function publicFromRow(db: SupabaseClient, row: Row, loaded?: Photo[]): Promise<PublicListing> {
  const photos = loaded ?? (await listPhotos(db, String(row.id)));
  const publicId = String(row.public_id);
  // lat/lng ya vienen desplazados ~500 m por la vista (approx_point); el punto exacto no sale de la tabla.
  const exact = row.lat !== null && row.lng !== null && row.lat !== undefined ? { lat: Number(row.lat), lng: Number(row.lng) } : null;
  return {
    publicId,
    kind: (row.kind as Kind) ?? "completo",
    title: String(row.title),
    description: String(row.description ?? ""),
    province: String(row.province),
    canton: String(row.canton ?? ""),
    zone: String(row.zone ?? ""),
    lat: exact?.lat ?? null,
    lng: exact?.lng ?? null,
    capacity: Number(row.capacity),
    bedrooms: Number(row.bedrooms),
    bathrooms: Number(row.bathrooms),
    bathroomShared: (row.bathroom_shared as boolean | null) ?? null,
    features: (row.features as Feature[]) ?? [],
    parkingPaid: (row.parking_paid as boolean | null) ?? null,
    acceptsNightly: row.accepts_nightly !== false,
    nightlyPriceCrc: row.nightly_price_crc === null || row.nightly_price_crc === undefined ? null : Number(row.nightly_price_crc),
    minNights: row.min_nights === null || row.min_nights === undefined ? null : Number(row.min_nights),
    acceptsMonthly: row.accepts_monthly === true,
    monthlyMode: (row.monthly_mode as MonthlyMode | null) ?? null,
    monthlyPriceCrc: row.monthly_price_crc === null || row.monthly_price_crc === undefined ? null : Number(row.monthly_price_crc),
    minMonths: row.min_months === null || row.min_months === undefined ? null : Number(row.min_months),
    available: row.available !== false,
    ownerName: String(row.owner_name ?? "Propietario"),
    ownerWhatsappVerified: row.owner_whatsapp_verified === true,
    createdAt: String(row.created_at),
    photos,
  };
}

/** Ficha pública por `CT-####`; null si no está activa. */
export async function getPublic(db: SupabaseClient, publicId: string): Promise<PublicListing | null> {
  const { data } = await db.from("listings_public").select(PUBLIC_COLUMNS).eq("public_id", publicId).maybeSingle();
  return data ? publicFromRow(db, data as Row) : null;
}

/** 'active' | 'blocked' (existe pero no se muestra) | null (no existe). */
export async function linkState(db: SupabaseClient, publicId: string): Promise<"active" | "blocked" | null> {
  const { data } = await db.rpc("listing_link_state", { p_public_id: publicId });
  return data === "active" || data === "blocked" ? data : null;
}

export async function listActivePublicIds(db: SupabaseClient): Promise<{ publicId: string; updatedAt: string }[]> {
  const { data } = await db.from("listings_public").select("public_id, updated_at").order("updated_at", { ascending: false }).limit(1000);
  return ((data as Row[] | null) ?? []).map((r) => ({ publicId: String(r.public_id), updatedAt: String(r.updated_at) }));
}

/** Catálogo con filtros (vista pública). Orden: más recientes primero. Las fotos se cargan en una sola consulta. */
export async function search(db: SupabaseClient, f: Filters): Promise<PublicListing[]> {
  let q = db.from("listings_public").select(PUBLIC_COLUMNS).order("created_at", { ascending: false }).limit(60);
  if (f.prov !== ALL_PROVINCES) q = q.eq("province", f.prov);
  if (f.mode === "nightly") q = q.eq("accepts_nightly", true);
  if (f.mode === "monthly") q = q.eq("accepts_monthly", true);
  if (f.ppl) q = q.gte("capacity", f.ppl);
  if (f.beds) q = q.gte("bedrooms", f.beds);
  if (f.features.length) q = q.contains("features", f.features);
  if (f.min) q = q.gte("nightly_price_crc", f.min);
  if (f.max) q = q.lte("nightly_price_crc", f.max);
  const { data } = await q;
  const rows = (data as Row[] | null) ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => String(r.id));
  const { data: photoRows } = await db.from("listing_photos").select("id, path, position, listing_id").in("listing_id", ids).order("position");
  const byListing = new Map<string, Photo[]>();
  for (const p of (photoRows as Row[] | null) ?? []) {
    const key = String(p.listing_id);
    byListing.set(key, [...(byListing.get(key) ?? []), toPhoto(p)]);
  }
  return Promise.all(rows.map((r) => publicFromRow(db, r, byListing.get(String(r.id)) ?? [])));
}

/** Casas activas en total: cuántas plazas de la oferta de lanzamiento van ocupadas. */
export async function countActiveListings(db: SupabaseClient): Promise<number> {
  const { count } = await db.from("listings_public").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** Provincias con al menos una casa activa, para los chips de Zona. */
export async function provincesWithListings(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from("listings_public").select("province");
  return [...new Set(((data as Row[] | null) ?? []).map((r) => String(r.province)))];
}

// ---------- Admin ----------
export interface QueueItem {
  listing: Listing;
  ownerName: string;
}
const ADMIN_COLUMNS = `${LISTING_COLUMNS}, profiles!owner_id(full_name)`;
const toQueueItem = (row: Row): QueueItem => ({ listing: fromRow(row), ownerName: String((row.profiles as Row | null)?.full_name ?? "Propietario") });

/** Cola del admin: en revisión primero (más antiguas arriba), luego decididas en los últimos 30 días. */
export async function queue(db: SupabaseClient): Promise<QueueItem[]> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [pending, decided] = await Promise.all([
    db.from("listings").select(ADMIN_COLUMNS).eq("status", "review").order("updated_at", { ascending: true }),
    db.from("listings").select(ADMIN_COLUMNS).in("status", ["active", "changes", "rejected"]).gte("reviewed_at", since).order("reviewed_at", { ascending: false }),
  ]);
  return [...((pending.data as Row[] | null) ?? []), ...((decided.data as Row[] | null) ?? [])].map(toQueueItem);
}

export async function getForAdmin(db: SupabaseClient, id: string): Promise<QueueItem | null> {
  const { data } = await db.from("listings").select(ADMIN_COLUMNS).eq("id", id).maybeSingle();
  return data ? toQueueItem(data as Row) : null;
}

/** Decisión del admin (RPC review_listing). */
export async function review(db: SupabaseClient, id: string, decision: "approve" | "changes" | "reject", note: string): Promise<Result> {
  const { error } = await db.rpc("review_listing", { p_listing: id, p_decision: decision, p_note: note });
  return error ? fail(error.message, "No pudimos guardar la decisión. Intente de nuevo.") : { ok: true };
}

/** Disponible / no disponible (RPC set_listing_available; solo casas activas). */
export async function setAvailable(db: SupabaseClient, id: string, value: boolean): Promise<Result> {
  const { error } = await db.rpc("set_listing_available", { p_listing: id, p_available: value });
  return error ? fail(error.message, "No pudimos cambiar la disponibilidad.") : { ok: true };
}

/** Editar una casa activa la devuelve a borrador (la ficha deja de verse hasta la nueva aprobación). `changes` se edita tal cual. */
export async function reopenForEdit(db: SupabaseClient, listing: Listing): Promise<Result> {
  if (listing.status === "changes" || listing.status === "draft") return { ok: true };
  if (listing.status !== "active") return { ok: false, error: "Este anuncio no se puede editar en su estado actual." };
  const { data, error } = await db.from("listings").update({ status: "draft" }).eq("id", listing.id).eq("owner_id", listing.ownerId).select("id");
  if (error) return fail(error.message, "No pudimos abrir el anuncio para editarlo.");
  return data && data.length > 0 ? { ok: true } : { ok: false, error: "No pudimos abrir el anuncio para editarlo." };
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
