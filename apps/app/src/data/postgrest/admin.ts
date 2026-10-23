// Adaptador PostgREST de la revisión del admin. La autorización la pone la base: la RLS de listings/profiles/listing_photos
// solo deja ver lo ajeno a un admin en aal2 (is_admin()) y review_listing lo vuelve a exigir. Aquí solo se distingue, para
// la interfaz, «no es admin» (nada, en vez de sus propias casas, que la RLS sí le deja leer) de «falta el segundo código».
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminListingsApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { REVIEW_MESSAGES as M, REJECTED_SHOWN, emptyQueue, reviewNoteRefusal, splitQueue, type QueueItem } from "../../domain/review";
import { fromListingRow, storagePhotoUrl, type ListingRow, type PhotoRow } from "../../domain/rows";
import { aalOf } from "./auth";

const ADMIN_COLUMNS = "*, listing_photos(id, path, position), owner:profiles!listings_owner_id_fkey(full_name)";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminRow = ListingRow & { listing_photos: PhotoRow[]; owner: { full_name: string } | null };

export function createPostgrestAdmin(db: SupabaseClient<Database>, opts: { supabaseUrl: string }): AdminListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const toItem = (row: AdminRow): QueueItem => ({ listing: fromListingRow(row, row.listing_photos, url), ownerName: row.owner?.full_name ?? "" });
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
