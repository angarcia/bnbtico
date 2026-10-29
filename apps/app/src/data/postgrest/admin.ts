// Adaptador PostgREST de la revisión del admin. La autorización la pone la base: la RLS de listings/profiles/listing_photos
// solo deja ver lo ajeno a un admin en aal2 (is_admin()) y review_listing lo vuelve a exigir. Aquí solo se distingue, para
// la interfaz, «no es admin» (nada, en vez de sus propias casas, que la RLS sí le deja leer) de «falta el segundo código».
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminHouse } from "../../domain/admin-houses";
import type { AdminListingsApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { EDIT_MESSAGES } from "../../domain/edit-messages";
import { DomainError, toDomainError } from "../../domain/errors";
import { REVIEW_MESSAGES as M, REJECTED_SHOWN, editQueueOrder, emptyQueue, reviewNoteRefusal, splitQueue, type QueueItem } from "../../domain/review";
import { costaRicaToday } from "../../domain/inquiry";
import { fromListingRow, fromPhotoRows, storagePhotoUrl, type EditRow, type ListingRow, type PhotoRow } from "../../domain/rows";
import { aalOf } from "./auth";

const EDIT_COLUMNS = "status, review_note, title, kind, bathroom_shared, description, lat, lng, zone, zone_id, zone_source, submitted_at, listing_edit_photos(id, path, position)";
const BASE_COLUMNS = "*, listing_photos(id, path, position), owner:profiles!listings_owner_id_fkey(full_name)";
const ADMIN_COLUMNS = `${BASE_COLUMNS}, listing_edits(${EDIT_COLUMNS})`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminRow = ListingRow & { listing_photos: PhotoRow[]; owner: { full_name: string } | null; listing_edits?: EditRow | null };

// Casas del admin: solo las que tienen suscripción (aprobadas alguna vez); la portada es la foto en la posición 0.
const HOUSE_COLUMNS =
  "id, public_id, title, status, zone, owner_id, first_published_at, listing_photos(id, path, position), owner:profiles!listings_owner_id_fkey(full_name), " +
  "subscriptions!inner(plan, promo_ends_on, paid_since, stopped_at, monthly_price_crc)";
type HouseRow = Pick<ListingRow, "id" | "public_id" | "title" | "status" | "zone" | "owner_id"> & {
  listing_photos: PhotoRow[];
  owner: { full_name: string } | null;
  subscriptions: { plan: string; promo_ends_on: string | null; paid_since: string | null; stopped_at: string | null; monthly_price_crc: number };
};

export function createPostgrestAdmin(db: SupabaseClient<Database>, opts: { supabaseUrl: string }): AdminListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const toItem = (row: AdminRow): QueueItem => ({ listing: fromListingRow(row, row.listing_photos, url, row.listing_edits), ownerName: row.owner?.full_name ?? "" });
  const mfa = () => new DomainError(M.mfaRequired, "forbidden");

  /** «admin» con aal2, «mfa» si es admin sin el segundo código, «none» si no es admin. Se pide junto con los datos. */
  async function access(): Promise<"admin" | "mfa" | "none"> {
    const { data } = await db.auth.getSession();
    const s = data.session;
    if (!s) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    const { data: me, error } = await db.from("profiles").select("is_admin").eq("id", s.user.id).maybeSingle();
    if (error) throw toDomainError(error);
    if (!me?.is_admin) return "none";
    return aalOf(s.access_token) === "aal2" ? "admin" : "mfa";
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

    async reviewEdit(id, decision, note, submittedAt) {
      const refusal = reviewNoteRefusal(decision, note);
      if (refusal) throw new DomainError(refusal, "validation");
      if (!UUID.test(id)) throw new DomainError(EDIT_MESSAGES.notFound, "validation");
      // p_submitted_at admite null (una edición sin enviar); los tipos generados no lo dicen.
      const { error } = await db.rpc("review_edit", { p_listing: id, p_decision: decision, p_note: note.trim(), p_submitted_at: submittedAt as string });
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
        return {
          listingId: row.id,
          publicId: row.public_id,
          title: row.title,
          status: row.status,
          ownerName: row.owner?.full_name ?? "",
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
          },
        };
      });
      return { houses, today };
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
