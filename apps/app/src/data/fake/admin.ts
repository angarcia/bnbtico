// Fake en memoria de la revisión del admin: mismas reglas y mensajes que la base. Admin = profiles.is_admin y sesión aal2
// (is_admin() de la migración admin_aal2_y_purga); quien no es admin no ve nada; review_listing con sus comprobaciones.
import type { AdminHouse } from "../../domain/admin-houses";
import type { AdminListingsApi, Session } from "../../domain/api";
import { EDIT_MESSAGES } from "../../domain/edit";
import { DomainError } from "../../domain/errors";
import { MAX_PHOTOS, MIN_PHOTOS, type Listing } from "../../domain/listing";
import { DECISION_STATUS, REVIEW_MESSAGES as M, editQueueOrder, emptyQueue, reviewNoteRefusal, splitQueue, type QueueItem } from "../../domain/review";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import { approveSubscription } from "./billing";
import type { FakeDb, FakeListing } from "./db";
import { editStore } from "./edits";

type Access = "admin" | "mfa" | "none";

export function createFakeAdmin(db: FakeDb, opts: { supabaseUrl: string; session: () => Session | null }): AdminListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const edits = editStore(db);

  function access(): Access {
    const s = opts.session();
    if (!s) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    if (!db.profiles.get(s.userId)?.isAdmin) return "none";
    return s.aal === "aal2" ? "admin" : "mfa";
  }
  const mfa = () => new DomainError(M.mfaRequired, "forbidden");

  const toItem = (l: FakeListing): QueueItem => {
    const photos = fromPhotoRows(db.photosOf(l.id), url);
    const listing: Listing = { ...l, features: [...l.features], photos, photoCount: photos.length, edit: edits.toEdit(l.id, url) };
    return { listing, ownerName: db.profiles.get(l.ownerId)?.fullName ?? "" };
  };

  return {
    async queue() {
      const a = access();
      if (a === "none") return emptyQueue();
      if (a === "mfa") throw mfa();
      const all = [...db.listings.values()];
      const items = all.filter((l) => l.status === "review" || l.status === "changes" || l.status === "rejected").map(toItem);
      return splitQueue(items, all.filter((l) => l.status === "active").length);
    },

    async get(id) {
      const a = access();
      if (a === "none") return null;
      if (a === "mfa") throw mfa();
      const l = db.listings.get(id);
      return l ? toItem(l) : null;
    },

    async editQueue() {
      const a = access();
      if (a === "none") return [];
      if (a === "mfa") throw mfa();
      return editQueueOrder([...db.edits.values()].filter((e) => e.status === "review").map((e) => toItem(db.listings.get(e.listingId)!)));
    },

    async getEdit(id) {
      const a = access();
      if (a === "none") return null;
      if (a === "mfa") throw mfa();
      const l = db.listings.get(id);
      return l && db.edits.has(id) ? toItem(l) : null;
    },

    /** review_edit: aprobar copia cada dato cambiado a la casa y añade las fotos nuevas tras las aprobadas; no toca estado,
     *  suscripción ni first_published_at. Pedir cambios deja la edición con la nota. */
    async reviewEdit(id, decision, note) {
      const refusal = reviewNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      const a = access();
      if (a === "none") throw new DomainError(M.adminOnly, "validation");
      if (a === "mfa") throw mfa();
      const l = db.listings.get(id);
      const e = db.edits.get(id);
      if (!l || !e) throw new DomainError(EDIT_MESSAGES.notFound, "validation");
      if (e.status !== "review") throw new DomainError(EDIT_MESSAGES.decided, "validation");
      const at = db.now();
      if (decision === "changes") {
        Object.assign(e, { status: "changes", reviewNote: note.trim().slice(0, 2000), reviewedAt: at });
        return;
      }
      const place = edits.check(l, e);
      const fresh = db.editPhotosOf(id);
      if (db.photosOf(id).length + fresh.length > MAX_PHOTOS) throw new DomainError(EDIT_MESSAGES.maxPhotos, "validation");
      const kind = e.kind ?? l.kind;
      Object.assign(l, {
        title: e.title ?? l.title,
        kind,
        bathroomShared: kind === "habitacion" ? (e.bathroomShared ?? l.bathroomShared) : null,
        description: e.description ?? l.description,
        ...(e.lat !== null && place ? { lat: e.lat, lng: e.lng, zoneId: e.zoneId, zoneSource: e.zoneSource, ...place } : {}),
        updatedAt: at,
      });
      const last = Math.max(-1, ...db.photosOf(id).map((p) => p.position));
      fresh.forEach((p, i) => db.photos.push({ ...p, position: last + 1 + i }));
      db.editPhotos = db.editPhotos.filter((p) => p.listingId !== id);
      db.edits.delete(id);
    },

    async houses() {
      const today = db.today();
      const a = access();
      if (a === "none") return { houses: [], today };
      if (a === "mfa") throw mfa();
      const houses = [...db.listings.values()]
        .flatMap((l) => {
          const sub = db.subscriptions.get(l.id);
          if (!sub) return [];
          const cover = fromPhotoRows(db.photosOf(l.id), url)[0] ?? null;
          const house: AdminHouse = {
            listingId: l.id,
            publicId: l.publicId,
            title: l.title,
            status: l.status,
            ownerName: db.profiles.get(l.ownerId)?.fullName ?? "",
            zone: l.zone,
            cover,
            subscription: {
              status: l.status,
              plan: sub.plan,
              promoEndsOn: sub.promoEndsOn,
              paidSince: sub.paidSince,
              stoppedOn: sub.stoppedOn,
              monthlyPriceCrc: sub.monthlyPriceCrc,
              hasMethod: db.paymentMethods.has(l.ownerId),
            },
          };
          return [{ house, at: l.firstPublishedAt ?? "" }];
        })
        .sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
        .map((x) => x.house);
      return { houses, today };
    },

    async review(id, decision, note) {
      const refusal = reviewNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      const a = access();
      if (a === "none") throw new DomainError(M.adminOnly, "validation");
      if (a === "mfa") throw mfa();
      const l = db.listings.get(id);
      if (!l) throw new DomainError(M.notFound, "validation");
      if (l.status !== "review") throw new DomainError(M.decided, "validation");
      if (decision === "approve" && db.photosOf(id).length < MIN_PHOTOS) throw new DomainError(M.fewPhotos, "validation");
      const text = note.trim().slice(0, 2000);
      const at = db.now();
      // Aprobar toma la plaza de la oferta la primera vez y decide entre activa y pendiente de pago (fase 5).
      const status = decision === "approve" ? approveSubscription(db, l) : DECISION_STATUS[decision];
      Object.assign(l, { status, reviewNote: text || null, reviewedAt: at, updatedAt: at });
      if (decision === "approve") l.firstPublishedAt ??= at;
      if (decision === "approve") {
        const owner = db.profiles.get(l.ownerId);
        if (owner) owner.isOwner = true;
      }
    },
  };
}
