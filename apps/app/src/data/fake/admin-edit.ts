// Fake en memoria de la edición del admin (ticket 10 de la ronda de Ana, migración admin_edita_casas): las mismas reglas y
// mensajes que las RPCs admin_*, con los núcleos que comparten con el anfitrión (planStep, editStore.live y .check, las
// comprobaciones de submit_listing, validateChange y applyChange del calendario). Admin = profiles.is_admin y sesión aal2.
import type { AdminEditApi, Session } from "../../domain/api";
import { applyChange, calendarWindow, validateChange } from "../../domain/calendar";
import { PUBLISHED_STATUSES } from "../../domain/can";
import { EDIT_MESSAGES, LIVE_KEYS, type EditPatch } from "../../domain/edit";
import { DomainError } from "../../domain/errors";
import { isPhotoFolder, photoObjectPaths } from "../../domain/image";
import { charCount, LOCATION_MESSAGES as LOC } from "../../domain/listing-rules";
import { MAX_PHOTOS, type Listing } from "../../domain/listing";
import { planStep } from "../../domain/publish-rules";
import { REVIEW_MESSAGES as M, type QueueItem } from "../../domain/review";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import type { ReviewedField } from "../../domain/edit-summary";
import { OTHER_ZONE_MAX } from "../../domain/zones";
import { nightlyBase } from "./calendar";
import { fakeEffectiveDays } from "./airbnb";
import { oneRoom, type FakeDb, type FakeListing } from "./db";
import { editStore, locationOf, type Located } from "./edits";
import { submitRefusal } from "./owner";
import { FAKE_ZONES } from "./places";

const FROZEN = "Esta casa está publicada: cambie sus datos desde su ficha.";
const invalid = (message: string) => new DomainError(message, "validation");
const EDIT_KEYS = ["title", "kind", "bathroomShared", "description", "lat", "lng", "zone", "zoneId", "zoneSource"] as const;
const LOCATION_KEYS = ["lat", "lng", "zone", "zoneSource"] as const;

export function createFakeAdminEdit(db: FakeDb, opts: { supabaseUrl: string; session: () => Session | null }): AdminEditApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const edits = editStore(db);

  function access(): "admin" | "mfa" | "none" {
    const s = opts.session();
    if (!s) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    if (!db.profiles.get(s.userId)?.isAdmin) return "none";
    return s.aal === "aal2" ? "admin" : "mfa";
  }
  const mfa = () => new DomainError(M.mfaRequired, "forbidden");
  const reader = () => {
    const a = access();
    if (a === "mfa") throw mfa();
    return a === "admin";
  };
  /** admin_house_for_action: admin con aal2 y casa que existe y no está eliminada. */
  function target(id: string): FakeListing {
    const a = access();
    if (a === "none") throw invalid(M.adminOnly);
    if (a === "mfa") throw mfa();
    const l = db.listings.get(id);
    if (!l || l.deletedAt !== null) throw invalid(M.notFound);
    return l;
  }
  const log = (listingId: string, action = "listing.edit") => db.adminActions.push({ action, listingId, reason: null });
  const published = (l: FakeListing) => PUBLISHED_STATUSES.includes(l.status) && l.firstPublishedAt !== null;
  const toListing = (l: FakeListing): Listing => {
    const photos = fromPhotoRows(db.photosOf(l.id), url);
    return { ...l, features: [...l.features], photos, photoCount: photos.length, edit: edits.toEdit(l.id, url) };
  };
  const live = (id: string) => {
    const l = db.listings.get(id);
    return l && l.deletedAt === null ? l : undefined;
  };

  /** Datos con revisión de una casa publicada, al momento: las reglas de save_edit y listing_edit_check, dato a dato; el
   *  pendiente del anfitrión de esos datos se descarta. Todo o nada. */
  function applyReviewed(l: FakeListing, patch: EditPatch): void {
    const keys = Object.keys(patch);
    const hasLocation = keys.some((k) => (LOCATION_KEYS as readonly string[]).includes(k) || k === "zoneId");
    if (keys.some((k) => !(EDIT_KEYS as readonly string[]).includes(k)) || (hasLocation && !LOCATION_KEYS.every((k) => k in patch))) throw invalid(EDIT_MESSAGES.notHere);
    const touched: ReviewedField[] = [];
    if ("title" in patch) touched.push("nombre");
    if ("kind" in patch || "bathroomShared" in patch) touched.push("tipo");
    if ("description" in patch) touched.push("descripcion");
    if (hasLocation) touched.push("ubicacion");
    const next: Partial<FakeListing> = {};
    for (const f of touched) {
      if (f === "nombre") {
        const title = (patch.title ?? "").trim();
        edits.check(l, { ...blank(l.id), title });
        next.title = title;
      } else if (f === "descripcion") {
        const description = (patch.description ?? "").trim();
        edits.check(l, { ...blank(l.id), description });
        next.description = description;
      } else if (f === "tipo") {
        const kind = patch.kind ?? l.kind;
        next.kind = kind;
        next.bathroomShared = kind === "habitacion" ? (patch.bathroomShared ?? l.bathroomShared) : null;
      } else {
        const zoneId = patch.zoneId ?? null;
        const zone = (patch.zone ?? "").trim();
        if (patch.lat == null || patch.lng == null || !zone || !patch.zoneSource || !["list", "district", "other"].includes(patch.zoneSource) || (zoneId !== null && !FAKE_ZONES.some((z) => z.id === zoneId))) {
          throw invalid(EDIT_MESSAGES.notHere);
        }
        if (charCount(zone) > OTHER_ZONE_MAX) throw invalid(LOC.longZone);
        const pin = { lat: patch.lat, lng: patch.lng, zone, zoneId, zoneSource: patch.zoneSource };
        const place = locationOf(pin);
        if ("error" in place) throw invalid(place.error);
        Object.assign(next, pin, place as Located);
      }
    }
    oneRoom(Object.assign(l, next, { updatedAt: db.now() }));
    for (const f of touched) edits.discardField(l.id, f);
  }
  const blank = (listingId: string) => ({
    listingId,
    fields: {},
    title: null,
    kind: null,
    bathroomShared: null,
    description: null,
    lat: null,
    lng: null,
    zone: null,
    zoneId: null,
    zoneSource: null,
  });

  const unpublished = (l: FakeListing, patch: Partial<FakeListing>) => oneRoom(Object.assign(l, patch, { updatedAt: db.now() }));
  const recompact = (listingId: string) => db.photosOf(listingId).forEach((p, i) => (p.position = i));

  return {
    async get(id) {
      if (!reader()) return null;
      const l = live(id);
      return l ? toListing(l) : null;
    },

    async drafts() {
      if (!reader()) return [];
      return [...db.listings.values()]
        .filter((l) => l.status === "draft" && l.firstPublishedAt === null && l.deletedAt === null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l): QueueItem => ({ listing: toListing(l), ownerName: db.profiles.get(l.ownerId)?.fullName ?? "" }));
    },

    async saveStep(id, step, patch, known) {
      if (known && known.id !== id) throw invalid(M.notFound);
      const l = target(id);
      const base = known ?? toListing(l);
      if (published(l)) throw invalid(FROZEN);
      const plan = planStep(base, step, patch);
      if ("error" in plan) throw invalid(plan.error);
      if (Object.keys(plan.changes).length === 0) return base;
      const { photoCount: _notAColumn, ...changes } = plan.changes;
      oneRoom(Object.assign(l, changes, { updatedAt: db.now() }));
      log(id);
      return toListing(l);
    },

    async updateLive(id, patch) {
      const l = target(id);
      if (Object.keys(patch).some((k) => !(LIVE_KEYS as readonly string[]).includes(k))) throw invalid(EDIT_MESSAGES.notHere);
      // Sin publicar, admin_update_listing guarda las columnas como el asistente (las reglas las pone planStep en la app).
      if (published(l)) edits.live(l, patch);
      else unpublished(l, patch);
      log(id);
    },

    async saveEdit(id, patch) {
      const l = target(id);
      if (published(l)) applyReviewed(l, patch);
      else unpublished(l, patch);
      log(id);
      return edits.toEdit(id, url);
    },

    async submit(id) {
      const l = target(id);
      const refusal = submitRefusal(l, db.photosOf(id).length);
      if (refusal) throw invalid(refusal);
      Object.assign(l, { status: "review", reviewNote: null, updatedAt: db.now(), ...(locationOf(l) as Located) });
      log(id, "listing.submit");
    },

    async addPhoto(listingId, folder) {
      target(listingId);
      if (!isPhotoFolder(listingId, folder)) throw invalid("Ruta de foto no válida.");
      const current = db.photosOf(listingId);
      if (current.length + db.editPhotosOf(listingId).length >= MAX_PHOTOS) throw invalid(`Máximo ${MAX_PHOTOS} fotos.`);
      const position = current.length ? Math.max(...current.map((p) => p.position)) + 1 : 0;
      const row = { id: db.newId(), listingId, path: folder, position };
      db.photos.push(row);
      log(listingId);
      return fromPhotoRows([row], url)[0]!;
    },

    async removePhoto(photoId) {
      // edit_admin_guard antes de buscar la foto, como admin_remove_listing_photo.
      const a = access();
      if (a === "none") throw invalid(M.adminOnly);
      if (a === "mfa") throw mfa();
      const photo = db.photos.find((p) => p.id === photoId);
      if (!photo) throw invalid("No encontramos esa foto.");
      const l = target(photo.listingId);
      if (published(l) && db.photosOf(l.id).length <= 1) throw invalid(EDIT_MESSAGES.lastPhoto);
      db.photos = db.photos.filter((p) => p.id !== photoId);
      recompact(l.id);
      const linked = (name: string) => [...db.photos, ...db.editPhotos].some((p) => p.path === name || name.startsWith(`${p.path}/`));
      photoObjectPaths(photo.path).filter((n) => !linked(n)).forEach((n) => db.objects.delete(n));
      log(l.id);
    },

    async reorderPhotos(listingId, photoIds) {
      target(listingId);
      const current = db.photosOf(listingId);
      const same = photoIds.length === current.length && new Set(photoIds).size === photoIds.length && photoIds.every((id) => current.some((p) => p.id === id));
      if (!same) throw new DomainError("La lista de fotos cambió. Vuelva a intentarlo.", "conflict");
      photoIds.forEach((id, i) => (current.find((p) => p.id === id)!.position = i));
      log(listingId);
    },

    async days(listingId) {
      if (!reader()) return [];
      const l = live(listingId);
      if (!l) return [];
      const { first, last } = calendarWindow(db.today());
      return fakeEffectiveDays(db, l.id, true).filter((d) => d.day >= first && d.day <= last);
    },

    async saveDays(listingId, change) {
      const l = target(listingId);
      const refusal = validateChange(change, { today: db.today(), listing: { status: l.status, available: l.available, nightlyPriceCrc: nightlyBase(l) } });
      if (refusal) throw invalid(refusal);
      db.days.set(l.id, applyChange(db.days.get(l.id) ?? [], nightlyBase(l), change));
      log(l.id);
    },
  };
}
