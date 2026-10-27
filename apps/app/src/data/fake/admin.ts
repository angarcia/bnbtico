// Fake en memoria de la revisión del admin: mismas reglas y mensajes que la base. Admin = profiles.is_admin y sesión aal2
// (is_admin() de la migración admin_aal2_y_purga); quien no es admin no ve nada; review_listing con sus comprobaciones.
import type { AdminHouse } from "../../domain/admin-houses";
import type { AdminListingsApi, Session } from "../../domain/api";
import { DomainError } from "../../domain/errors";
import { MIN_PHOTOS, type Listing } from "../../domain/listing";
import { DECISION_STATUS, REVIEW_MESSAGES as M, emptyQueue, reviewNoteRefusal, splitQueue, type QueueItem } from "../../domain/review";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import { approveSubscription } from "./billing";
import type { FakeDb, FakeListing } from "./db";

type Access = "admin" | "mfa" | "none";

export function createFakeAdmin(db: FakeDb, opts: { supabaseUrl: string; session: () => Session | null }): AdminListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);

  function access(): Access {
    const s = opts.session();
    if (!s) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    if (!db.profiles.get(s.userId)?.isAdmin) return "none";
    return s.aal === "aal2" ? "admin" : "mfa";
  }
  const mfa = () => new DomainError(M.mfaRequired, "forbidden");

  const toItem = (l: FakeListing): QueueItem => {
    const photos = fromPhotoRows(db.photosOf(l.id), url);
    const listing: Listing = { ...l, features: [...l.features], photos, photoCount: photos.length };
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
