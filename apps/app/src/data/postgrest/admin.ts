// Adaptador PostgREST de la revisión del admin. La autorización la pone la base: la RLS de listings/profiles/listing_photos
// solo deja ver lo ajeno a un admin en aal2 (is_admin()) y review_listing lo vuelve a exigir. Aquí solo se distingue, para
// la interfaz, «no es admin» (nada, en vez de sus propias casas, que la RLS sí le deja leer) de «falta el segundo código».
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_HOLD_MESSAGES as H, holdReasonRefusal } from "../../domain/admin-actions";
import { holdFromRow } from "../../domain/admin-hold";
import type { AdminHouse } from "../../domain/admin-houses";
import type { AdminListingsApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { EDIT_MESSAGES } from "../../domain/edit-messages";
import { DomainError, toDomainError } from "../../domain/errors";
import { REVIEW_MESSAGES as M, REJECTED_SHOWN, editNoteRefusal, editQueueOrder, emptyQueue, reviewNoteRefusal, splitQueue, type QueueItem } from "../../domain/review";
import { costaRicaToday } from "../../domain/inquiry";
import { EDIT_SELECT, fromListingRow, fromPhotoRows, storagePhotoUrl, type EditRow, type ListingRow, type PhotoRow } from "../../domain/rows";
import { FIELD_COLUMN } from "../../domain/edit-summary";
import { adminAccess } from "./admin-access";

const EDIT_COLUMNS = EDIT_SELECT;
const BASE_COLUMNS = "*, listing_photos(id, path, position), owner:profiles!listings_owner_id_fkey(full_name)";
const ADMIN_COLUMNS = `${BASE_COLUMNS}, listing_edits(${EDIT_COLUMNS})`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminRow = ListingRow & { listing_photos: PhotoRow[]; owner: { full_name: string } | null; listing_edits?: EditRow | null };

// Casas del admin: solo las que tienen suscripción (aprobadas alguna vez); la portada es la foto en la posición 0.
const HOUSE_COLUMNS =
  "id, public_id, title, status, zone, owner_id, first_published_at, whatsapp_phone, admin_hold, admin_hold_reason, listing_photos(id, path, position), owner:profiles!listings_owner_id_fkey(full_name), " +
  "subscriptions!inner(plan, promo_ends_on, paid_since, stopped_at, monthly_price_crc)";
type HouseRow = Pick<ListingRow, "id" | "public_id" | "title" | "status" | "zone" | "owner_id" | "admin_hold" | "admin_hold_reason" | "whatsapp_phone"> & {
  listing_photos: PhotoRow[];
  owner: { full_name: string } | null;
  subscriptions: { plan: string; promo_ends_on: string | null; paid_since: string | null; stopped_at: string | null; monthly_price_crc: number };
};

export function createPostgrestAdmin(db: SupabaseClient<Database>, opts: { supabaseUrl: string }): AdminListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const toItem = (row: AdminRow): QueueItem => ({ listing: fromListingRow(row, row.listing_photos, url, row.listing_edits), ownerName: row.owner?.full_name ?? "" });
  const mfa = () => new DomainError(M.mfaRequired, "forbidden");

  /** «admin» con aal2, «mfa» si es admin sin el segundo código, «none» si no es admin. Se pide junto con los datos. */
  const access = () => adminAccess(db);

  /** Una RPC del admin: error de la base como DomainError, con el segundo código aparte. */
  async function call(rpc: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
    const { error } = await rpc;
    if (!error) return;
    const e = toDomainError(error);
    throw e.message === M.mfaRequired ? mfa() : e;
  }

  async function holdRpc(fn: "admin_pause_listing" | "admin_block_listing", id: string, reason: string): Promise<void>;
  async function holdRpc(fn: "admin_resume_listing" | "admin_unblock_listing", id: string): Promise<void>;
  async function holdRpc(fn: string, id: string, reason?: string): Promise<void> {
    if (reason !== undefined) {
      const refusal = holdReasonRefusal(reason);
      if (refusal) throw new DomainError(refusal, "validation");
    }
    if (!UUID.test(id)) throw new DomainError(M.notFound, "validation");
    if (fn === "admin_pause_listing" || fn === "admin_block_listing") return call(db.rpc(fn, { p_listing: id, p_reason: reason!.trim() }));
    return call(db.rpc(fn as "admin_resume_listing" | "admin_unblock_listing", { p_listing: id }));
  }

  return {
    async queue() {
      const [who, pending, rejected, active] = await Promise.all([
        access(),
        db.from("listings").select(ADMIN_COLUMNS).in("status", ["review", "changes"]).order("updated_at", { ascending: true }).returns<AdminRow[]>(),
        db.from("listings").select(ADMIN_COLUMNS).eq("status", "rejected").order("reviewed_at", { ascending: false }).limit(REJECTED_SHOWN).returns<AdminRow[]>(),
        db.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);
      if (who === "none") return emptyQueue();
      if (who === "mfa") throw mfa();
      for (const r of [pending, rejected, active]) if (r.error) throw toDomainError(r.error);
      return splitQueue([...(pending.data ?? []), ...(rejected.data ?? [])].map(toItem), active.count ?? 0);
    },

    async get(id) {
      if (!UUID.test(id)) return null;
      const [who, res] = await Promise.all([access(), db.from("listings").select(ADMIN_COLUMNS).eq("id", id).returns<AdminRow[]>().maybeSingle()]);
      if (who === "none") return null;
      if (who === "mfa") throw mfa();
      if (res.error) throw toDomainError(res.error);
      return res.data ? toItem(res.data) : null;
    },

    async editQueue() {
      const [who, res] = await Promise.all([
        access(),
        db.from("listings").select(`${BASE_COLUMNS}, listing_edits!inner(${EDIT_COLUMNS})`).eq("listing_edits.status", "review").returns<AdminRow[]>(),
      ]);
      if (who === "none") return [];
      if (who === "mfa") throw mfa();
      if (res.error) throw toDomainError(res.error);
      return editQueueOrder((res.data ?? []).map(toItem));
    },

    async getEdit(id) {
      const item = await this.get(id);
      return item?.listing.edit ? item : null;
    },

    async reviewEditField(id, field, decision, note, submittedAt) {
      const refusal = editNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      if (!UUID.test(id)) throw new DomainError(EDIT_MESSAGES.notFound, "validation");
      // p_submitted_at admite null (un dato que ya no está pendiente); los tipos generados no lo dicen.
      const { error } = await db.rpc("review_edit_field", { p_listing: id, p_field: FIELD_COLUMN[field], p_decision: decision, p_note: note.trim(), p_submitted_at: submittedAt as string });
      if (!error) return;
      const e = toDomainError(error);
      throw e.message === M.mfaRequired ? mfa() : e;
    },

    async reviewEditPhoto(photoId, decision, note, submittedAt) {
      const refusal = editNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      if (!UUID.test(photoId)) throw new DomainError(EDIT_MESSAGES.photoNotFound, "validation");
      const { error } = await db.rpc("review_edit_photo", { p_photo: photoId, p_decision: decision, p_note: note.trim(), p_submitted_at: submittedAt as string });
      if (!error) return;
      const e = toDomainError(error);
      throw e.message === M.mfaRequired ? mfa() : e;
    },

    async houses() {
      const today = costaRicaToday(Date.now());
      const [who, res, methods] = await Promise.all([
        access(),
        db
          .from("listings")
          .select(HOUSE_COLUMNS)
          .eq("listing_photos.position", 0)
          .order("first_published_at", { ascending: false, nullsFirst: false })
          .order("public_id", { ascending: false })
          .returns<HouseRow[]>(),
        db.from("payment_methods").select("owner_id"),
      ]);
      if (who === "none") return { houses: [], today };
      if (who === "mfa") throw mfa();
      for (const r of [res, methods]) if (r.error) throw toDomainError(r.error);
      const withMethod = new Set((methods.data ?? []).map((m) => m.owner_id));
      const houses = (res.data ?? []).map((row): AdminHouse => {
        const s = row.subscriptions;
        const hold = holdFromRow(row.admin_hold, row.admin_hold_reason);
        return {
          listingId: row.id,
          publicId: row.public_id,
          title: row.title,
          status: row.status,
          ownerName: row.owner?.full_name ?? "",
          ownerPhone: row.whatsapp_phone,
          zone: row.zone ?? "",
          cover: fromPhotoRows(row.listing_photos, url)[0] ?? null,
          subscription: {
            status: row.status,
            plan: s.plan === "paid" ? "paid" : "promo",
            promoEndsOn: s.promo_ends_on,
            paidSince: s.paid_since,
            stoppedOn: s.stopped_at ? costaRicaToday(Date.parse(s.stopped_at)) : null,
            monthlyPriceCrc: s.monthly_price_crc,
            hasMethod: withMethod.has(row.owner_id),
            hold: hold?.kind ?? null,
          },
          hold,
        };
      });
      return { houses, today };
    },

    pauseListing: (id, reason) => holdRpc("admin_pause_listing", id, reason),
    resumeListing: (id) => holdRpc("admin_resume_listing", id),
    blockListing: (id, reason) => holdRpc("admin_block_listing", id, reason),
    unblockListing: (id) => holdRpc("admin_unblock_listing", id),
    async deleteListing(id, reason, confirm) {
      const refusal = holdReasonRefusal(reason);
      if (refusal) throw new DomainError(refusal, "validation");
      if (!UUID.test(id)) throw new DomainError(M.notFound, "validation");
      if (confirm.trim() === "") throw new DomainError(H.confirmCode, "validation");
      return call(db.rpc("admin_delete_listing", { p_listing: id, p_reason: reason.trim(), p_confirm: confirm.trim() }));
    },

    async review(id, decision, note) {
      const refusal = reviewNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      if (!UUID.test(id)) throw new DomainError(M.notFound, "validation");
      const { error } = await db.rpc("review_listing", { p_listing: id, p_decision: decision, p_note: note.trim() });
      if (!error) return;
      const e = toDomainError(error);
      throw e.message === M.mfaRequired ? mfa() : e;
    },
  };
}
