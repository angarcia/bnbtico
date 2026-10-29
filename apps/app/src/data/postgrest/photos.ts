// Adaptador de fotos: los objetos van del navegador a Storage con la sesión del dueño (la política de storage.objects
// exige casa propia en borrador o con cambios, nombres conocidos y como mucho 45 objetos por carpeta de casa); las filas
// las escriben las RPCs add/remove/reorder, que calculan la posición y ponen el tope de 15 fotos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { UPLOAD_FAILED_MESSAGE, type PhotosApi } from "../../domain/api";
import { createLimiter } from "../../domain/concurrency";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { PHOTO_CACHE_SECONDS, VARIANT_SIZES, photoFolder, photoObjectPaths, variantPath } from "../../domain/image";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";

const BUCKET = "listings";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPostgrestPhotos(db: SupabaseClient<Database>, opts: { supabaseUrl: string }): PhotosApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const bucket = () => db.storage.from(BUCKET);
  // Una sola cola para todas las fotos de esta instancia: tres objetos a la vez, también si se eligen diez fotos juntas.
  const limit = createLimiter(3);

  return {
    async upload(listingId, variants, onUploaded) {
      const folder = photoFolder(listingId, crypto.randomUUID());
      const done: string[] = [];
      const results = await Promise.allSettled(
        VARIANT_SIZES.map((size) =>
          limit(async () => {
            const name = variantPath(folder, size);
            const { error } = await bucket().upload(name, variants[size], { contentType: "image/jpeg", cacheControl: String(PHOTO_CACHE_SECONDS), upsert: false });
            if (error) throw error;
            done.push(name);
            onUploaded?.();
          }),
        ),
      );
      const failed = results.find((r) => r.status === "rejected");
      if (failed) {
        if (done.length) await bucket().remove(done);
        const e = toDomainError(failed.reason);
        throw e.kind === "network" || e.kind === "session" ? e : new DomainError(UPLOAD_FAILED_MESSAGE, "forbidden");
      }
      return folder;
    },

    async add(listingId, folder) {
      if (!UUID.test(listingId)) throw new DomainError("No encontramos ese anuncio.", "not_found");
      const { data, error } = await db.rpc("add_listing_photo", { p_listing: listingId, p_path: folder }).single();
      if (error) throw toDomainError(error);
      return fromPhotoRows([data], url)[0]!;
    },

    async discard(folder) {
      await bucket().remove(photoObjectPaths(folder));
    },

    async remove(photoId) {
      if (!UUID.test(photoId)) throw new DomainError("No encontramos esa foto.", "not_found");
      const { data: path, error } = await db.rpc("remove_listing_photo", { p_photo: photoId });
      if (error) throw toDomainError(error);
      // La fila ya no está: si borrar los objetos falla, quedan huérfanos en Storage pero nadie los enlaza.
      await bucket().remove(photoObjectPaths(path));
    },

    async reorder(listingId, photoIds) {
      if (!UUID.test(listingId)) throw new DomainError("No encontramos ese anuncio.", "not_found");
      const { error } = await db.rpc("reorder_listing_photos", { p_listing: listingId, p_ids: photoIds });
      if (error) throw toDomainError(error);
    },

    async addEditPhoto(listingId, folder) {
      if (!UUID.test(listingId)) throw new DomainError("No encontramos ese anuncio.", "not_found");
      const { data, error } = await db.rpc("add_edit_photo", { p_listing: listingId, p_path: folder }).single();
      if (error) throw toDomainError(error);
      return fromPhotoRows([data], url)[0]!;
    },

    async removeEditPhoto(photoId) {
      if (!UUID.test(photoId)) throw new DomainError("No encontramos esa foto.", "not_found");
      const { data: path, error } = await db.rpc("remove_edit_photo", { p_photo: photoId });
      if (error) throw toDomainError(error);
      await bucket().remove(photoObjectPaths(path));
    },

    async reorderEditPhotos(listingId, photoIds) {
      if (!UUID.test(listingId)) throw new DomainError("No encontramos ese anuncio.", "not_found");
      const { error } = await db.rpc("reorder_edit_photos", { p_listing: listingId, p_ids: photoIds });
      if (error) throw toDomainError(error);
    },
  };
}
