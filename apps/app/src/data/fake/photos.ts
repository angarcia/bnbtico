// Fake en memoria de las fotos: Storage simulado (FakeDb.objects) con la política de la base (casa propia en borrador o
// con cambios, nombres conocidos, 45 objetos por carpeta) y las RPCs add/remove/reorder con sus mensajes.
import { UPLOAD_FAILED_MESSAGE, type PhotosApi } from "../../domain/api";
import { createLimiter } from "../../domain/concurrency";
import { DomainError } from "../../domain/errors";
import { PHOTO_CACHE_SECONDS, VARIANT_SIZES, isPhotoFolder, photoFolder, photoObjectPaths, variantPath } from "../../domain/image";
import { MAX_PHOTOS } from "../../domain/listing";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import type { FakeDb } from "./db";

const NOT_FOUND = "No encontramos ese anuncio.";
const FROZEN = "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.";
const MAX_OBJECTS_PER_LISTING = 45;
const OBJECT_NAME = /^[0-9a-f-]{36}\/[0-9a-f-]{36}(\/(480|800|1600))?\.jpg$/;

export function createFakePhotos(db: FakeDb, opts: { supabaseUrl: string; userId: () => string | null }): PhotosApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const limit = createLimiter(3);

  function me(): string {
    const id = opts.userId();
    if (!id) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    return id;
  }

  /** listing_editable: suya y en borrador o con cambios pedidos. */
  const editable = (listingId: string) => {
    const l = db.listings.get(listingId);
    return !!l && l.ownerId === opts.userId() && (l.status === "draft" || l.status === "changes");
  };

  /** listing_photos_guard. */
  function guard(listingId: string) {
    const l = db.listings.get(listingId);
    if (!l || l.ownerId !== me()) throw new DomainError(NOT_FOUND, "not_found");
    if (l.status !== "draft" && l.status !== "changes") throw new DomainError(FROZEN, "validation");
  }

  /** Política de insert de storage.objects. */
  function putObject(name: string, blob: Blob) {
    const listingId = name.split("/")[0]!;
    const inFolder = [...db.objects.keys()].filter((k) => k.startsWith(`${listingId}/`)).length;
    if (!OBJECT_NAME.test(name) || !editable(listingId) || inFolder >= MAX_OBJECTS_PER_LISTING || db.objects.has(name)) {
      throw new DomainError(UPLOAD_FAILED_MESSAGE, "forbidden");
    }
    db.objects.set(name, { cacheControl: `max-age=${PHOTO_CACHE_SECONDS}`, contentType: blob.type, size: blob.size });
  }

  /** Política de delete de storage.objects: solo en casas editables del usuario; lo demás se ignora en silencio. */
  const deleteObjects = (names: string[]) => names.filter((n) => editable(n.split("/")[0]!)).forEach((n) => db.objects.delete(n));

  const recompact = (listingId: string) => db.photosOf(listingId).forEach((p, i) => (p.position = i));

  return {
    async upload(listingId, variants, onUploaded) {
      me();
      const folder = photoFolder(listingId, crypto.randomUUID());
      const done: string[] = [];
      try {
        await Promise.all(
          VARIANT_SIZES.map((size) =>
            limit(async () => {
              const name = variantPath(folder, size);
              putObject(name, variants[size]);
              done.push(name);
              onUploaded?.();
            }),
          ),
        );
      } catch {
        deleteObjects(done);
        throw new DomainError(UPLOAD_FAILED_MESSAGE, "forbidden");
      }
      return folder;
    },

    async add(listingId, folder) {
      guard(listingId);
      if (!isPhotoFolder(listingId, folder)) throw new DomainError("Ruta de foto no válida.", "validation");
      const current = db.photosOf(listingId);
      if (current.length >= MAX_PHOTOS) throw new DomainError(`Máximo ${MAX_PHOTOS} fotos.`, "validation");
      const position = current.length ? Math.max(...current.map((p) => p.position)) + 1 : 0;
      const row = { id: db.newId(), listingId, path: folder, position };
      db.photos.push(row);
      return fromPhotoRows([row], url)[0]!;
    },

    async discard(folder) {
      deleteObjects(photoObjectPaths(folder));
    },

    async remove(photoId) {
      const photo = db.photos.find((p) => p.id === photoId);
      if (!photo || db.listings.get(photo.listingId)?.ownerId !== me()) throw new DomainError("No encontramos esa foto.", "not_found");
      guard(photo.listingId);
      db.photos = db.photos.filter((p) => p.id !== photoId);
      recompact(photo.listingId);
      deleteObjects(photoObjectPaths(photo.path));
    },

    async reorder(listingId, photoIds) {
      guard(listingId);
      const current = db.photosOf(listingId);
      const same = photoIds.length === current.length && new Set(photoIds).size === photoIds.length && photoIds.every((id) => current.some((p) => p.id === id));
      if (!same) throw new DomainError("La lista de fotos cambió. Vuelva a intentarlo.", "conflict");
      photoIds.forEach((id, i) => (current.find((p) => p.id === id)!.position = i));
    },
  };
}
