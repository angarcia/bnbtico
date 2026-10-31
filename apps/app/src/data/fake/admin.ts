// Fake en memoria de la revisión del admin: mismas reglas y mensajes que la base. Admin = profiles.is_admin y sesión aal2
// (is_admin() de la migración admin_aal2_y_purga); quien no es admin no ve nada; review_listing con sus comprobaciones.
import { ADMIN_HOLD_MESSAGES as H, deleteConfirmMatches, holdReasonRefusal } from "../../domain/admin-actions";
import type { AdminHouse } from "../../domain/admin-houses";
import type { AdminListingsApi, Session } from "../../domain/api";
import { EDIT_MESSAGES } from "../../domain/edit-messages";
import { addDays } from "../../domain/calendar";
import { DomainError } from "../../domain/errors";
import { MAX_PHOTOS, MIN_PHOTOS_TO_APPROVE, type Listing } from "../../domain/listing";
import { PUBLISHED_STATUSES } from "../../domain/can";
import { DECISION_STATUS, REVIEW_MESSAGES as M, editNoteRefusal, editQueueOrder, emptyQueue, reviewNoteRefusal, splitQueue, type QueueItem } from "../../domain/review";
import { fromPhotoRows, storagePhotoUrl } from "../../domain/rows";
import { approveSubscription } from "./billing";
import { costaRicaToday } from "../../domain/inquiry";
import type { FakeDb, FakeListing } from "./db";
import { editStore } from "./edits";

type Access = "admin" | "mfa" | "none";

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

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
  /** Como la RLS: una casa eliminada no la lee nadie por REST. */
  const live = () => [...db.listings.values()].filter((l) => l.deletedAt === null);

  /** admin_house_for_action: admin con aal2 y casa que existe (no eliminada). Va antes que el motivo, como en SQL. */
  function target(id: string) {
    const a = access();
    if (a === "none") throw new DomainError(M.adminOnly, "validation");
    if (a === "mfa") throw mfa();
    const l = db.listings.get(id);
    if (!l || l.deletedAt !== null) throw new DomainError(M.notFound, "validation");
    return l;
  }
  const reasonOf = (reason: string) => {
    const refusal = holdReasonRefusal(reason);
    if (refusal) throw new DomainError(refusal, "validation");
    return reason.trim().slice(0, 2000);
  };
  const published = (l: FakeListing) => PUBLISHED_STATUSES.includes(l.status) && l.firstPublishedAt !== null;
  const dropQueued = (listingId: string) => (db.reminders = db.reminders.filter((r) => !(r.listingId === listingId && r.status === "queued")));

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
      const all = live();
      const items = all.filter((l) => l.status === "review" || l.status === "changes" || l.status === "rejected").map(toItem);
      return splitQueue(items, all.filter((l) => l.status === "active").length);
    },

    async get(id) {
      const a = access();
      if (a === "none") return null;
      if (a === "mfa") throw mfa();
      const l = db.listings.get(id);
      return l && l.deletedAt === null ? toItem(l) : null;
    },

    async editQueue() {
      const a = access();
      if (a === "none") return [];
      if (a === "mfa") throw mfa();
      return editQueueOrder(
        [...db.edits.keys()].filter((id) => db.listings.get(id)!.deletedAt === null).map((id) => toItem(db.listings.get(id)!)).filter((item) => item.listing.edit?.status === "review"),
      );
    },

    async getEdit(id) {
      const a = access();
      if (a === "none") return null;
      if (a === "mfa") throw mfa();
      const l = db.listings.get(id);
      return l && l.deletedAt === null && db.edits.has(id) ? toItem(l) : null;
    },

    /** review_edit_field: aprobar copia el dato a la casa (sin tocar estado, suscripción ni first_published_at) y lo quita de
     *  la edición; pedir cambios lo deja con la nota. Lo demás de la edición no cambia. */
    async reviewEditField(id, field, decision, note, submittedAt) {
      const refusal = editNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      const a = access();
      if (a === "none") throw new DomainError(M.adminOnly, "validation");
      if (a === "mfa") throw mfa();
      const l = db.listings.get(id);
      const state = db.edits.get(id)?.fields[field];
      if (!l || !state) throw new DomainError(submittedAt === null ? EDIT_MESSAGES.notFound : EDIT_MESSAGES.changed, "validation");
      if (state.submittedAt !== submittedAt) throw new DomainError(EDIT_MESSAGES.changed, "validation");
      if (state.status !== "review") throw new DomainError(EDIT_MESSAGES.decided, "validation");
      if (decision === "changes") {
        Object.assign(state, { status: "changes", reviewNote: note.trim().slice(0, 2000) });
        return;
      }
      edits.applyField(l, field);
    },

    /** review_edit_photo: aprobada, va tras la última aprobada; con cambios pedidos, queda con la nota. */
    async reviewEditPhoto(photoId, decision, note, submittedAt) {
      const refusal = editNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      const a = access();
      if (a === "none") throw new DomainError(M.adminOnly, "validation");
      if (a === "mfa") throw mfa();
      const photo = db.editPhotos.find((p) => p.id === photoId);
      if (!photo) throw new DomainError(submittedAt === null ? EDIT_MESSAGES.photoNotFound : EDIT_MESSAGES.changed, "validation");
      if (photo.submittedAt !== submittedAt) throw new DomainError(EDIT_MESSAGES.changed, "validation");
      if (photo.status !== "review") throw new DomainError(EDIT_MESSAGES.decided, "validation");
      if (decision === "changes") {
        Object.assign(photo, { status: "changes", reviewNote: note.trim().slice(0, 2000) });
        return;
      }
      const id = photo.listingId;
      if (db.photosOf(id).length >= MAX_PHOTOS) throw new DomainError(EDIT_MESSAGES.maxPhotos, "validation");
      const last = Math.max(-1, ...db.photosOf(id).map((p) => p.position));
      db.photos.push({ id: photo.id, listingId: id, path: photo.path, position: last + 1 });
      db.editPhotos = db.editPhotos.filter((p) => p.id !== photoId);
      db.editPhotosOf(id).forEach((p, i) => (p.position = i));
      edits.dropIfEmpty(id);
    },

    async houses() {
      const today = db.today();
      const a = access();
      if (a === "none") return { houses: [], today };
      if (a === "mfa") throw mfa();
      const houses = live()
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
            ownerPhone: l.whatsappPhone,
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
              hold: l.adminHold?.kind ?? null,
            },
            hold: l.adminHold,
          };
          return [{ house, at: l.firstPublishedAt ?? "" }];
        })
        .sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
        .map((x) => x.house);
      return { houses, today };
    },

    async pauseListing(id, reason) {
      const text = reasonOf(reason);
      const l = target(id);
      if (!published(l)) throw new DomainError(H.notPublished, "validation");
      if (l.adminHold?.kind === "blocked") throw new DomainError(H.blockedFirst, "validation");
      if (l.adminHold?.kind === "paused") throw new DomainError(H.alreadyPaused, "validation");
      Object.assign(l, { adminHold: { kind: "paused", reason: text }, adminHoldAt: new Date(db.clock()).toISOString() });
      db.adminActions.push({ action: "listing.pause", listingId: l.id, reason: text });
    },

    async resumeListing(id) {
      const l = target(id);
      if (l.adminHold?.kind !== "paused") throw new DomainError(H.notPaused, "validation");
      Object.assign(l, { adminHold: null, adminHoldAt: null });
      db.adminActions.push({ action: "listing.resume", listingId: l.id, reason: null });
    },

    async blockListing(id, reason) {
      const text = reasonOf(reason);
      const l = target(id);
      if (!published(l)) throw new DomainError(H.notPublished, "validation");
      if (l.adminHold?.kind === "blocked") throw new DomainError(H.alreadyBlocked, "validation");
      Object.assign(l, { adminHold: { kind: "blocked", reason: text }, adminHoldAt: new Date(db.clock()).toISOString() });
      dropQueued(l.id);
      db.adminActions.push({ action: "listing.block", listingId: l.id, reason: text });
    },

    /** admin_unblock_listing: la oferta gratuita no se consume mientras estuvo bloqueada, y una pendiente de pago cuyo
     *  propietario puso método mientras tanto se activa. */
    async unblockListing(id) {
      const l = target(id);
      if (l.adminHold?.kind !== "blocked") throw new DomainError(H.notBlocked, "validation");
      const sub = db.subscriptions.get(l.id);
      const today = db.today();
      const days = Math.max(0, daysBetween(costaRicaToday(Date.parse(l.adminHoldAt!)), today));
      if (sub?.plan === "promo" && sub.promoEndsOn) sub.promoEndsOn = addDays(sub.promoEndsOn, days);
      if (l.status === "payment_due" && db.paymentMethods.has(l.ownerId)) {
        if (sub) Object.assign(sub, { plan: "paid", paidSince: sub.paidSince ?? today });
        l.status = "active";
      }
      Object.assign(l, { adminHold: null, adminHoldAt: null, updatedAt: db.now() });
      db.adminActions.push({ action: "listing.unblock", listingId: l.id, reason: null });
    },

    async deleteListing(id, reason, confirm) {
      const text = reasonOf(reason);
      const l = target(id);
      if (!deleteConfirmMatches(l.publicId, confirm)) throw new DomainError(H.confirmCode, "validation");
      Object.assign(l, { deletedAt: db.now(), deletedReason: text });
      dropQueued(l.id);
      db.adminActions.push({ action: "listing.delete", listingId: l.id, reason: text });
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
      if (decision === "approve" && db.photosOf(id).length < MIN_PHOTOS_TO_APPROVE) throw new DomainError(M.fewPhotos, "validation");
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
