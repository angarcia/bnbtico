// Fake en memoria de las casas del propietario: mismas reglas y mensajes que la base (RLS de listings, trigger
// listings_protect, política listings_owner_delete y RPC set_listing_available).
import type { OwnerManageApi } from "../../domain/api";
import { discardRefusal } from "../../domain/can";
import { DomainError } from "../../domain/errors";
import type { Listing } from "../../domain/listing";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import type { FakeDb, FakeListing } from "./db";

const NOT_FOUND = "No encontramos ese anuncio.";

export function createFakeOwnerListings(db: FakeDb, opts: { supabaseUrl: string; userId: () => string | null }): OwnerManageApi {
  const url = storagePhotoUrl(opts.supabaseUrl);

  function me(): string {
    const id = opts.userId();
    if (!id) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    return id;
  }

  /** Como la RLS de select: solo las propias (también para el admin, porque listOwn filtra por dueño). */
  function own(id: string): FakeListing | undefined {
    const l = db.listings.get(id);
    return l && l.ownerId === me() ? l : undefined;
  }

  const toListing = (l: FakeListing): Listing => {
    const photos = fromPhotoRows(db.photosOf(l.id), url);
    return { ...l, features: [...l.features], photos, photoCount: photos.length };
  };

  const touch = (l: FakeListing, patch: Partial<FakeListing>) => Object.assign(l, patch, { updatedAt: db.now() });

  return {
    async listOwn() {
      const owner = me();
      return [...db.listings.values()]
        .filter((l) => l.ownerId === owner)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toListing);
    },

    async getOwn(id) {
      const l = own(id);
      return l ? toListing(l) : null;
    },

    async setAvailable(id, available) {
      const l = own(id);
      if (!l || l.status !== "active") throw new DomainError("Solo puede cambiar la disponibilidad de una casa activa.", "validation");
      touch(l, { available });
    },

    async reopenForEdit(id) {
      const l = own(id);
      if (!l) throw new DomainError(NOT_FOUND, "not_found");
      if (l.status === "draft") return void touch(l, {});
      if (l.status !== "active" && l.status !== "changes" && l.status !== "rejected") {
        throw new DomainError("Solo bnbtico puede cambiar el estado de un anuncio.", "validation");
      }
      touch(l, { status: "draft" });
    },

    async deleteDraft(id) {
      const l = own(id);
      const refusal = discardRefusal(l ?? null);
      if (refusal) throw new DomainError(refusal, l ? "validation" : "not_found");
      db.listings.delete(id);
      db.photos = db.photos.filter((p) => p.listingId !== id);
    },
  };
}
