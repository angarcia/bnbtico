// Fake en memoria de las casas del propietario: mismas reglas y mensajes que la base (RLS de listings, trigger
// listings_protect, política listings_owner_delete y RPCs set_listing_available y submit_listing). Guardar una pantalla
// valida con planStep, como el adaptador PostgREST. La edición de una casa publicada sigue las reglas de ./edits.
import type { OwnerListingsApi } from "../../domain/api";
import { availabilityUpdate, CALENDAR_MESSAGES } from "../../domain/calendar";
import { discardRefusal } from "../../domain/can";
import { DomainError } from "../../domain/errors";
import {
  MAX_PHOTOS,
  TITLE_MAX,
  TITLE_MIN,
  type Listing,
} from "../../domain/listing";
import {
  charCount,
  NIGHTLY_PRICE_ERROR,
  TITLE_EMPTY_ERROR,
  TITLE_LENGTH_ERROR,
} from "../../domain/listing-rules";
import {
  PHOTO_REQUIRED_ERROR,
  planStep,
} from "../../domain/publish-rules";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import type { FakeDb, FakeListing } from "./db";
import { editStore, locationOf, type Located } from "./edits";

const NOT_FOUND = "No encontramos ese anuncio.";
/** Política listings_owner_insert y trigger listings_insert_guard (ticket 08). */
const MAX_OPEN_DRAFTS = 5;
const FROZEN = "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.";

/** Las comprobaciones de la RPC submit_listing, en su orden y con sus mensajes. */
function submitRefusal(l: FakeListing, photos: number): string | null {
  if (l.status === "review") return "Este anuncio ya está en revisión.";
  if (l.status !== "draft" && l.status !== "changes") return "Este anuncio no se puede enviar en su estado actual.";
  if (!l.kind) return "Elija Alojamiento completo o Habitación.";
  const located = locationOf(l);
  if ("error" in located) return located.error;
  // Solo lo obligatorio (2026-10-30): nombre de 5 a 32, al menos una foto y precio por noche; capacidad, habitaciones,
  // baños, descripción, parqueo y precio al mes ya no bloquean.
  if (!l.title.trim()) return TITLE_EMPTY_ERROR;
  if (charCount(l.title) < TITLE_MIN || charCount(l.title) > TITLE_MAX) return TITLE_LENGTH_ERROR;
  if (photos < 1) return PHOTO_REQUIRED_ERROR;
  if (photos > MAX_PHOTOS) return `Máximo ${MAX_PHOTOS} fotos.`;
  if ((l.nightlyPriceCrc ?? 0) <= 0) return NIGHTLY_PRICE_ERROR;
  return null;
}

export function createFakeOwnerListings(db: FakeDb, opts: { supabaseUrl: string; userId: () => string | null }): OwnerListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const edits = editStore(db);

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
    return { ...l, features: [...l.features], photos, photoCount: photos.length, edit: edits.toEdit(l.id, url) };
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

    async findResumable() {
      const owner = me();
      const drafts = [...db.listings.values()].filter((l) => l.ownerId === owner && l.status === "draft" && l.reviewedAt === null);
      const newest = drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      return newest ? toListing(newest) : null;
    },

    async createDraft() {
      const owner = me();
      const open = [...db.listings.values()].filter((l) => l.ownerId === owner && l.status === "draft" && l.reviewedAt === null).length;
      if (open >= MAX_OPEN_DRAFTS) throw new DomainError(`Ya tiene ${MAX_OPEN_DRAFTS} borradores sin enviar. Termine o descarte uno antes de empezar otro.`, "validation");
      const l = db.insertListing(owner);
      return { id: l.id, publicId: l.publicId };
    },

    async saveStep(id, step, patch, known) {
      const l = own(id);
      if (!l || (known && known.id !== id)) throw new DomainError(NOT_FOUND, "not_found");
      const base = known ?? toListing(l);
      if (base.status !== "draft" && base.status !== "changes") throw new DomainError(FROZEN, "validation");
      const plan = planStep(base, step, patch);
      if ("error" in plan) throw new DomainError(plan.error, "validation");
      if (Object.keys(plan.changes).length === 0) return known ?? toListing(l);
      if (l.status !== "draft" && l.status !== "changes") throw new DomainError(FROZEN, "validation"); // el trigger
      const { photoCount: _notAColumn, ...changes } = plan.changes;
      touch(l, changes);
      return toListing(l);
    },

    async submit(id) {
      const l = own(id);
      if (!l) throw new DomainError(NOT_FOUND, "validation");
      const refusal = submitRefusal(l, db.photosOf(id).length);
      if (refusal) throw new DomainError(refusal, "validation");
      touch(l, { status: "review", reviewNote: null, ...(locationOf(l) as Located) });
    },

    async setAvailable(id, available, reopenAt = null) {
      const l = own(id);
      if (!l) throw new DomainError(CALENDAR_MESSAGES.notActive, "validation");
      const next = availabilityUpdate(l, available, reopenAt, db.today());
      if ("error" in next) throw new DomainError(next.error, "validation");
      touch(l, next);
    },

    async reopenForEdit(id) {
      const l = own(id);
      if (!l) throw new DomainError(NOT_FOUND, "not_found");
      if (l.status === "draft") return void touch(l, {});
      // Una casa publicada ya no vuelve a borrador (trigger listings_protect): se edita con updateLive y saveEdit.
      if (l.status !== "changes" && l.status !== "rejected") throw new DomainError("Solo bnbtico puede cambiar el estado de un anuncio.", "validation");
      touch(l, { status: "draft" });
    },

    async updateLive(id, patch) {
      edits.live(edits.published(id, me()), patch);
    },

    async saveEdit(id, patch) {
      const l = edits.published(id, me());
      return edits.save(l, patch) ? edits.toEdit(id, url) : null;
    },

    async discardEditField(id, field) {
      edits.published(id, me());
      edits.discardField(id, field);
    },

    async stats(id) {
      const l = own(id);
      if (!l) throw new DomainError("No encontramos ese anuncio.", "not_found");
      const since = Date.now() - 30 * 86_400_000;
      return {
        views: db.views.filter((v) => v.publicId === l.publicId && Date.parse(v.at) > since).length,
        inquiries: db.inquiries.filter((i) => i.listingId === id && Date.parse(i.createdAt) > since).length,
      };
    },

    async ownerActivity() {
      const owner = me();
      const since = Date.now() - 30 * 86_400_000;
      const recent = (rows: { publicId: string; at: string }[], publicId: string) => rows.filter((r) => r.publicId === publicId && Date.parse(r.at) > since).length;
      return [...db.listings.values()]
        .filter((l) => l.ownerId === owner)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => ({
          listingId: l.id,
          publicId: l.publicId,
          views: recent(db.views, l.publicId),
          whatsappTaps: recent(db.taps, l.publicId),
          inquiries: db.inquiries.filter((i) => i.listingId === l.id && Date.parse(i.createdAt) > since).length,
        }));
    },

    async deleteDraft(id) {
      const l = own(id);
      const refusal = discardRefusal(l ?? null);
      if (refusal) throw new DomainError(refusal, l ? "validation" : "not_found");
      db.listings.delete(id);
      db.photos = db.photos.filter((p) => p.listingId !== id);
      db.days.delete(id);
    },
  };
}
