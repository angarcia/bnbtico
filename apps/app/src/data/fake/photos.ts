// Fake en memoria de las fotos: Storage simulado (FakeDb.objects) con la política de la base (casa propia en borrador o
// con cambios, o publicada sin edición en revisión; nombres conocidos, 45 objetos por carpeta) y las RPCs add/remove/reorder
// (y las de fotos nuevas de una edición, con las reglas de editStore) con sus mensajes.
import { UPLOAD_FAILED_MESSAGE, type PhotosApi } from "../../domain/api";
import { createLimiter } from "../../domain/concurrency";
import { DomainError } from "../../domain/errors";
import { PHOTO_CACHE_SECONDS, VARIANT_SIZES, isPhotoFolder, photoFolder, photoObjectPaths, variantPath } from "../../domain/image";
import { EDIT_MESSAGES } from "../../domain/edit-messages";
import { MAX_PHOTOS } from "../../domain/listing";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import type { FakeDb, FakeListing } from "./db";
import { editStore } from "./edits";

const NOT_FOUND = "No encontramos ese anuncio.";
const FROZEN = "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.";
const MAX_OBJECTS_PER_LISTING = 45;
const OBJECT_NAME = /^[0-9a-f-]{36}\/[0-9a-f-]{36}(\/(480|800|1600))?\.jpg$/;

export function createFakePhotos(db: FakeDb, opts: { supabaseUrl: string; userId: () => string | null }): PhotosApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const limit = createLimiter(3);
  const edits = editStore(db);

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

  /** listing_is_published: aprobada alguna vez y activa, pendiente de pago o inactiva. */
  const isPublished = (l: FakeListing) => ["active", "payment_due", "inactive"].includes(l.status) && l.firstPublishedAt !== null;

  /** listing_photo_uploadable: editable, o publicada (cada foto nueva va a revisión por su cuenta). */
  const uploadable = (listingId: string) => {
    const l = db.listings.get(listingId);
    return editable(listingId) || (!!l && l.ownerId === opts.userId() && isPublished(l));
  };

  /** listing_photos_guard: añadir fotos aprobadas, solo en borrador o con cambios. */
  function guard(listingId: string) {
    const l = db.listings.get(listingId);
    if (!l || l.ownerId !== me()) throw new DomainError(NOT_FOUND, "not_found");
    if (isPublished(l)) throw new DomainError(EDIT_MESSAGES.newPhotosReviewed, "validation");
    if (l.status !== "draft" && l.status !== "changes") throw new DomainError(FROZEN, "validation");
  }

  /** listing_photos_owner_guard: quitar y ordenar, también en una casa publicada. Devuelve si lo está. */
  function ownerGuard(listingId: string): boolean {
    const l = db.listings.get(listingId);
    if (!l || l.ownerId !== me()) throw new DomainError(NOT_FOUND, "not_found");
    if (isPublished(l)) return true;
    if (l.status !== "draft" && l.status !== "changes") throw new DomainError(FROZEN, "validation");
    return false;
  }

  /** Política de insert de storage.objects. */
  function putObject(name: string, blob: Blob) {
    const listingId = name.split("/")[0]!;
    const inFolder = [...db.objects.keys()].filter((k) => k.startsWith(`${listingId}/`)).length;
    if (!OBJECT_NAME.test(name) || !uploadable(listingId) || inFolder >= MAX_OBJECTS_PER_LISTING || db.objects.has(name)) {
      throw new DomainError(UPLOAD_FAILED_MESSAGE, "forbidden");
    }
    db.objects.set(name, { cacheControl: `max-age=${PHOTO_CACHE_SECONDS}`, contentType: blob.type, size: blob.size });
  }

  /** photo_unreferenced: ningún registro de foto (aprobada o nueva) enlaza el objeto. */
  const unreferenced = (name: string) => ![...db.photos, ...db.editPhotos].some((p) => p.path === name || name.startsWith(`${p.path}/`));

  /** Política de delete de storage.objects: casa del usuario y objeto sin enlazar; lo demás se ignora en silencio. */
  const deleteObjects = (names: string[]) =>
    names
      .filter((n) => db.listings.get(n.split("/")[0]!)?.ownerId === opts.userId() && unreferenced(n))
      .forEach((n) => db.objects.delete(n));

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
      const published = ownerGuard(photo.listingId);
      if (published && db.photosOf(photo.listingId).length <= 1) throw new DomainError(EDIT_MESSAGES.lastPhoto, "validation");
      db.photos = db.photos.filter((p) => p.id !== photoId);
      recompact(photo.listingId);
      deleteObjects(photoObjectPaths(photo.path));
    },

    async reorder(listingId, photoIds) {
      ownerGuard(listingId);
      const current = db.photosOf(listingId);
      const same = photoIds.length === current.length && new Set(photoIds).size === photoIds.length && photoIds.every((id) => current.some((p) => p.id === id));
      if (!same) throw new DomainError("La lista de fotos cambió. Vuelva a intentarlo.", "conflict");
      photoIds.forEach((id, i) => (current.find((p) => p.id === id)!.position = i));
    },

    async addEditPhoto(listingId, folder) {
      const l = edits.published(listingId, me());
      const invalid = () => new DomainError("Ruta de foto no válida.", "validation");
      if (!isPhotoFolder(listingId, folder)) throw invalid();
      if (db.photos.some((p) => p.path === folder) || db.editPhotos.some((p) => p.path === folder)) throw invalid();
      const mine = db.editPhotosOf(listingId);
      if (db.photosOf(listingId).length + mine.length >= MAX_PHOTOS) throw new DomainError(EDIT_MESSAGES.maxPhotos, "validation");
      edits.start(l);
      // Va a revisión al registrarla (revisión por dato, A5).
      const row = { id: db.newId(), listingId, path: folder, position: mine.length ? Math.max(...mine.map((p) => p.position)) + 1 : 0, status: "review" as const, reviewNote: null, submittedAt: db.now() };
      db.editPhotos.push(row);
      return fromPhotoRows([row], url)[0]!;
    },

    async removeEditPhoto(photoId) {
      const photo = db.editPhotos.find((p) => p.id === photoId);
      if (!photo || db.listings.get(photo.listingId)?.ownerId !== me()) throw new DomainError("No encontramos esa foto.", "not_found");
      edits.published(photo.listingId, me());
      db.editPhotos = db.editPhotos.filter((p) => p.id !== photoId);
      db.editPhotosOf(photo.listingId).forEach((p, i) => (p.position = i));
      edits.dropIfEmpty(photo.listingId);
      deleteObjects(photoObjectPaths(photo.path));
    },

    async reorderEditPhotos(listingId, photoIds) {
      edits.published(listingId, me());
      const e = db.edits.get(listingId);
      if (!e) throw new DomainError(EDIT_MESSAGES.notFound, "not_found");
      const current = db.editPhotosOf(listingId);
      const same = photoIds.length === current.length && new Set(photoIds).size === photoIds.length && photoIds.every((id) => current.some((p) => p.id === id));
      if (!same) throw new DomainError("La lista de fotos cambió. Vuelva a intentarlo.", "conflict");
      photoIds.forEach((id, i) => (current.find((p) => p.id === id)!.position = i));
    },
  };
}
