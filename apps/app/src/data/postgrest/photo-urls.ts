// Historia #69: las fotos aprobadas de casas visibles están en el bucket público (`listings`, URL fija, caché de un año);
// el resto en el privado (`listings-privadas`), que el dueño y el admin con segundo factor ven con URL firmada. Las firmas se
// piden de una vez por respuesta y valen lo mismo que la caché persistida de Query (24 h): una entrada restaurada nunca
// trae una firma caducada. El service worker solo guarda en caché `/object/public/`: las firmadas no entran en ninguna.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../domain/database.types";
import { photoObjectPaths } from "../../domain/image";
import { storagePhotoUrl, type PhotoUrl } from "../../domain/rows";

export const PRIVATE_PHOTO_BUCKET = "listings-privadas";
export const PUBLIC_PHOTO_BUCKET = "listings";
const SIGNED_URL_SECONDS = 24 * 60 * 60;

/** Una foto con su bucket; sin él (una recién subida, las de una edición) está en el privado. */
export type PhotoSource = { path: string; bucket?: string | null };

/** Fotos de una fila de listings con sus ediciones (lo que piden Mis casas y Admin). */
export function photoSources(row: { listing_photos?: readonly PhotoSource[] | null; listing_edits?: { listing_edit_photos?: readonly { path: string }[] | null } | null }): PhotoSource[] {
  return [...(row.listing_photos ?? []), ...(row.listing_edits?.listing_edit_photos ?? []).map((p) => ({ path: p.path }))];
}

export function createPhotoSigner(db: SupabaseClient<Database>, supabaseUrl: string) {
  const publicUrl = storagePhotoUrl(supabaseUrl);
  return async (photos: readonly PhotoSource[]): Promise<PhotoUrl> => {
    const keys = [...new Set(photos.filter((p) => p.bucket !== "public").flatMap((p) => photoObjectPaths(p.path)))];
    if (keys.length === 0) return publicUrl;
    const { data, error } = await db.storage.from(PRIVATE_PHOTO_BUCKET).createSignedUrls(keys, SIGNED_URL_SECONDS);
    // Sin firmas la pantalla carga igual (las fotos privadas no se verán); una foto que el worker acaba de pasar al público
    // tampoco tiene firma y su URL pública ya funciona.
    const signed = new Map((error ? [] : data).flatMap((d) => (d.path && d.signedUrl && !d.error ? [[d.path, d.signedUrl] as const] : [])));
    return (key) => signed.get(key) ?? publicUrl(key);
  };
}

/** Borra los objetos de una foto de los dos buckets (estará en uno: depende de si ya se publicó). La fila ya no está:
 *  si borrar falla, quedan huérfanos que nadie enlaza. */
export async function removeObjects(db: SupabaseClient<Database>, keys: string[]): Promise<void> {
  await Promise.all([db.storage.from(PRIVATE_PHOTO_BUCKET).remove(keys), db.storage.from(PUBLIC_PHOTO_BUCKET).remove(keys)]);
}

/** Pide al worker que mueva las fotos que han cambiado de sitio (tras aprobar, parar, reanudar o borrar). Sin esperar:
 *  si falla, el cron horario lo hace. */
export function requestPhotoSync(): void {
  if (typeof fetch === "undefined" || typeof location === "undefined") return;
  void fetch("/api/fotos/sincronizar", { method: "POST", keepalive: true }).catch(() => undefined);
}
