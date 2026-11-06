// Adaptador PostgREST de la edición del admin (ronda de Ana del 2 nov, ticket 10): lecturas de listings sin filtrar por
// dueño (la RLS solo deja ver lo ajeno a un admin en aal2) y escrituras con las RPCs admin_* (is_admin() en aal2, casa no
// eliminada, una línea en admin_actions por guardado). Guardar una pantalla del asistente valida en TypeScript con
// planStep, como cuando guarda el anfitrión; la base pone las demás reglas con sus mensajes.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminEditApi } from "../../domain/api";
import { CALENDAR_MESSAGES, calendarWindow, isIsoDate } from "../../domain/calendar";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { costaRicaToday } from "../../domain/inquiry";
import { planStep } from "../../domain/publish-rules";
import { REVIEW_MESSAGES as M } from "../../domain/review";
import { EDIT_SELECT, fromDayRow, fromEditRow, fromListingRow, fromPhotoRows, storagePhotoUrl, toEditPatch, toListingUpdate, toLivePatch, type EditRow } from "../../domain/rows";
import { photoObjectPaths } from "../../domain/image";
import { adminAccess } from "./admin-access";

const COLUMNS = `*, listing_photos(id, path, position), listing_edits(${EDIT_SELECT})`;
const DRAFT_COLUMNS = `${COLUMNS}, owner:profiles!listings_owner_id_fkey(full_name)`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FROZEN = "Esta casa está publicada: cambie sus datos desde su ficha.";

export function createPostgrestAdminEdit(db: SupabaseClient<Database>, opts: { supabaseUrl: string; now?: () => number }): AdminEditApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const now = opts.now ?? Date.now;

  /** Lo que piden todas las lecturas: sin ser admin, nada; sin el segundo código, que lo confirme. */
  async function reader(): Promise<boolean> {
    const a = await adminAccess(db);
    if (a === "mfa") throw new DomainError(M.mfaRequired, "forbidden");
    return a === "admin";
  }
  /** Una RPC del admin: el error de la base como DomainError, con el segundo código aparte (para llevar a confirmarlo). */
  async function call<T>(rpc: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await rpc;
    if (!error) return data;
    const e = toDomainError(error);
    throw e.message === M.mfaRequired ? new DomainError(M.mfaRequired, "forbidden") : e;
  }
  const notFound = () => new DomainError(M.notFound, "validation");

  /** La casa tal como la deja leer la RLS (sin comprobar antes quién es: tras una RPC del admin, ya se sabe). */
  async function read(id: string) {
    const { data, error } = await db.from("listings").select(COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw toDomainError(error);
    return data ? fromListingRow(data, data.listing_photos, url, data.listing_edits) : null;
  }
  /** Una lectura a la vez que la comprobación de quién es (admin-access.ts); sin ser admin, se descarta lo leído. */
  async function asAdmin<T>(load: () => Promise<T>, none: T): Promise<T> {
    const [admin, data] = await Promise.all([reader(), load()]);
    return admin ? data : none;
  }
  const get = async (id: string) => (UUID.test(id) ? asAdmin(() => read(id), null) : null);

  async function readEdit(id: string) {
    const { data, error } = await db.from("listing_edits").select(EDIT_SELECT).eq("listing_id", id).maybeSingle<EditRow>();
    if (error) throw toDomainError(error);
    return fromEditRow(data, url);
  }

  return {
    get,

    async drafts() {
      return asAdmin(async () => {
        const { data, error } = await db
          .from("listings")
          .select(DRAFT_COLUMNS)
          .eq("status", "draft")
          .is("first_published_at", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .returns<(Parameters<typeof fromListingRow>[0] & { listing_photos: Parameters<typeof fromPhotoRows>[0]; listing_edits: EditRow | null; owner: { full_name: string } | null })[]>();
        if (error) throw toDomainError(error);
        return data.map((row) => ({ listing: fromListingRow(row, row.listing_photos, url, row.listing_edits), ownerName: row.owner?.full_name ?? "" }));
      }, []);
    },

    async saveStep(id, step, patch, known) {
      if (!UUID.test(id) || (known && known.id !== id)) throw notFound();
      // Con `known` (la casa que ya tiene el navegador) no se relee antes: la RPC vuelve a comprobar quién es y la casa.
      // Sin ella, se lee a la vez que se comprueba quién es.
      const [admin, current] = known ? [true, known] : await Promise.all([reader(), read(id)]);
      if (!admin) throw new DomainError(M.adminOnly, "validation");
      if (!current) throw notFound();
      if (current.firstPublishedAt !== null && ["active", "payment_due", "inactive"].includes(current.status)) throw new DomainError(FROZEN, "validation");
      const plan = planStep(current, step, patch);
      if ("error" in plan) throw new DomainError(plan.error, "validation");
      const row = toListingUpdate(plan.changes);
      if (Object.keys(row).length === 0) return current;
      await call(db.rpc("admin_update_listing", { p_listing: id, p_patch: row }));
      const saved = await read(id);
      if (!saved) throw notFound();
      return saved;
    },

    async updateLive(id, patch) {
      if (!UUID.test(id)) throw notFound();
      await call(db.rpc("admin_update_listing", { p_listing: id, p_patch: toLivePatch(patch) }));
    },

    async saveEdit(id, patch) {
      if (!UUID.test(id)) throw notFound();
      await call(db.rpc("admin_update_listing", { p_listing: id, p_patch: toEditPatch(patch) }));
      return readEdit(id);
    },

    async submit(id) {
      if (!UUID.test(id)) throw notFound();
      await call(db.rpc("admin_submit_listing", { p_listing: id }));
    },

    async addPhoto(listingId, folder) {
      if (!UUID.test(listingId)) throw notFound();
      const data = await call(db.rpc("admin_add_listing_photo", { p_listing: listingId, p_path: folder }).single());
      if (!data) throw notFound();
      return fromPhotoRows([data], url)[0]!;
    },

    async removePhoto(photoId) {
      if (!UUID.test(photoId)) throw new DomainError("No encontramos esa foto.", "not_found");
      const path = await call(db.rpc("admin_remove_listing_photo", { p_photo: photoId }));
      // La fila ya no está: si borrar los objetos falla, quedan huérfanos en Storage pero nadie los enlaza.
      if (path) await db.storage.from("listings").remove(photoObjectPaths(path));
    },

    async reorderPhotos(listingId, photoIds) {
      if (!UUID.test(listingId)) throw notFound();
      await call(db.rpc("admin_reorder_listing_photos", { p_listing: listingId, p_ids: photoIds }));
    },

    async days(listingId) {
      if (!UUID.test(listingId)) return [];
      const { first, last } = calendarWindow(costaRicaToday(now()));
      return asAdmin(async () => {
        const { data, error } = await db.from("listing_days").select("day, available, special_price_crc").eq("listing_id", listingId).gte("day", first).lte("day", last).order("day");
        if (error) throw toDomainError(error);
        return data.map(fromDayRow);
      }, []);
    },

    async saveDays(listingId, change) {
      if (!UUID.test(listingId)) throw new DomainError(CALENDAR_MESSAGES.notFound, "validation");
      // Lo que no llega a la base con su tipo se rechaza aquí con el mismo mensaje que daría la RPC (como el anfitrión).
      if (!change.days.every(isIsoDate)) throw new DomainError(CALENDAR_MESSAGES.range, "validation");
      if (change.priceCrc !== undefined && !Number.isInteger(change.priceCrc)) throw new DomainError(CALENDAR_MESSAGES.price, "validation");
      await call(
        db.rpc("admin_save_listing_days", {
          p_listing: listingId,
          p_days: change.days,
          ...(change.available === undefined ? {} : { p_available: change.available }),
          ...(change.priceCrc === undefined ? {} : { p_price_crc: change.priceCrc }),
        }),
      );
    },
  };
}
