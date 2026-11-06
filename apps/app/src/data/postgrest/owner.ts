// Adaptador PostgREST de las casas del propietario. La tabla `listings` solo la leen dueño y admin (RLS); por eso
// listOwn y getOwn filtran además por el usuario de la sesión. Las reglas de estado las aplica la base: aquí solo se
// traduce lo que la base calla (un update o delete filtrado por RLS devuelve cero filas, sin error). Guardar una pantalla
// valida en TypeScript (planStep, igual que el fake); enviar lo valida la RPC submit_listing.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerListingsApi } from "../../domain/api";
import { CALENDAR_MESSAGES, isIsoDate } from "../../domain/calendar";
import { discardRefusal } from "../../domain/can";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { DEFAULT_PROVINCE } from "../../domain/listing";
import { planStep } from "../../domain/publish-rules";
import { EDIT_SELECT, fromEditRow, fromListingRow, storagePhotoUrl, toEditPatch, toListingUpdate, toLivePatch, type EditRow } from "../../domain/rows";
import { FIELD_COLUMN } from "../../domain/edit-summary";

const OWN_COLUMNS = `*, listing_photos(id, path, position), listing_edits(${EDIT_SELECT})`;
const NOT_FOUND = "No encontramos ese anuncio.";
/** El mensaje del trigger listings_protect; se adelanta aquí porque una pantalla sin cambios no llega a la base. */
const FROZEN = "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Escritura sin esperas: un cliente de supabase-js sin sesión propia y el token tal como está guardado, leído sin
 * esperar. Con él, la petición de un guardado sale en el mismo tick que el envío del formulario (antes de que la app
 * pueda cerrarse). `null` si no hay token vigente a mano: entonces se usa el camino normal, que espera a la sesión.
 */
export type QuickWrite = () => { db: SupabaseClient<Database>; accessToken: string; userId: string } | null;

export function createPostgrestOwnerListings(db: SupabaseClient<Database>, opts: { supabaseUrl: string; quickWrite?: QuickWrite }): OwnerListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);

  async function me(): Promise<string> {
    const { data } = await db.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    return id;
  }

  async function getOwn(id: string) {
    if (!UUID.test(id)) return null;
    const { data, error } = await db.from("listings").select(OWN_COLUMNS).eq("id", id).eq("owner_id", await me()).maybeSingle();
    if (error) throw toDomainError(error);
    return data ? fromListingRow(data, data.listing_photos, url, data.listing_edits) : null;
  }

  return {
    async listOwn() {
      const { data, error } = await db.from("listings").select(OWN_COLUMNS).eq("owner_id", await me()).order("created_at", { ascending: false });
      if (error) throw toDomainError(error);
      return data.map((row) => fromListingRow(row, row.listing_photos, url, row.listing_edits));
    },

    getOwn,

    async findResumable() {
      const { data, error } = await db
        .from("listings")
        .select(OWN_COLUMNS)
        .eq("owner_id", await me())
        .eq("status", "draft")
        .is("reviewed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw toDomainError(error);
      return data ? fromListingRow(data, data.listing_photos, url, data.listing_edits) : null;
    },

    async createDraft(id) {
      // El WhatsApp sale de la sesión (sin otro viaje a la base): GoTrue lo guarda sin «+». Al insertar, listings_insert_guard
      // lo reescribe con el del perfil para todos menos el admin; sin teléfono en la sesión, se lee el perfil como antes.
      const { data: auth } = await db.auth.getSession();
      const owner = auth.session?.user.id;
      if (!owner) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
      let phone = auth.session?.user.phone ? `+${auth.session.user.phone.replace(/^\+/, "")}` : null;
      if (!phone) {
        const profile = await db.from("profiles").select("phone").eq("id", owner).single();
        if (profile.error) throw toDomainError(profile.error);
        phone = profile.data.phone;
      }
      // Nada preseleccionado salvo lo que no se pregunta: toda casa se alquila por noches y el mensual empieza en No. La fila
      // vuelve entera (como getOwn) para que la pantalla no tenga que pedirla otra vez.
      const { data, error } = await db
        .from("listings")
        .insert({ ...(id ? { id } : {}), owner_id: owner, title: "", description: "", province: DEFAULT_PROVINCE, whatsapp_phone: phone, accepts_nightly: true, accepts_monthly: false })
        .select(OWN_COLUMNS)
        .single();
      if (error) throw toDomainError(error);
      return { id: data.id, publicId: data.public_id, listing: fromListingRow(data, data.listing_photos, url, data.listing_edits) };
    },

    async saveStep(id, step, patch, known) {
      if (!UUID.test(id) || (known && known.id !== id)) throw new DomainError(NOT_FOUND, "not_found");
      const current = known ?? (await getOwn(id));
      if (!current) throw new DomainError(NOT_FOUND, "not_found");
      if (current.status !== "draft" && current.status !== "changes") throw new DomainError(FROZEN, "validation");
      const plan = planStep(current, step, patch);
      if ("error" in plan) throw new DomainError(plan.error, "validation");
      const row = toListingUpdate(plan.changes);
      if (Object.keys(row).length === 0) return current;
      // Con `known` no hay ninguna espera antes de la petición: con keepalive llega aunque la app se cierre justo después.
      const quick = known ? opts.quickWrite?.() : null;
      const query = quick
        ? quick.db.from("listings").update(row).eq("id", id).eq("owner_id", quick.userId).select(OWN_COLUMNS).setHeader("Authorization", `Bearer ${quick.accessToken}`)
        : db.from("listings").update(row).eq("id", id).eq("owner_id", await me()).select(OWN_COLUMNS);
      const { data, error } = await query.maybeSingle();
      if (error) throw toDomainError(error);
      if (!data) throw new DomainError(NOT_FOUND, "not_found");
      return fromListingRow(data, data.listing_photos, url, data.listing_edits);
    },

    async submit(id) {
      if (!UUID.test(id)) throw new DomainError(NOT_FOUND, "not_found");
      const { error } = await db.rpc("submit_listing", { p_listing: id });
      if (error) throw toDomainError(error);
    },

    async setAvailable(id, available, reopenAt) {
      // Una fecha que no existe no llega a la base con su tipo: el mismo mensaje que daría la RPC.
      if (reopenAt && !isIsoDate(reopenAt)) throw new DomainError(CALENDAR_MESSAGES.reopenDate, "validation");
      const { error } = await db.rpc("set_listing_available", { p_listing: id, p_available: available, ...(reopenAt ? { p_reopen_at: reopenAt } : {}) });
      if (error) throw toDomainError(error);
    },

    async reopenForEdit(id) {
      if (!UUID.test(id)) throw new DomainError(NOT_FOUND, "not_found");
      const { data, error } = await db.from("listings").update({ status: "draft" }).eq("id", id).eq("owner_id", await me()).select("id");
      if (error) throw toDomainError(error);
      if (data.length === 0) throw new DomainError(NOT_FOUND, "not_found");
    },

    async updateLive(id, patch) {
      if (!UUID.test(id)) throw new DomainError(NOT_FOUND, "not_found");
      const { error } = await db.rpc("update_listing_live", { p_listing: id, p_patch: toLivePatch(patch) });
      if (error) throw toDomainError(error);
    },

    async saveEdit(id, patch) {
      if (!UUID.test(id)) throw new DomainError(NOT_FOUND, "not_found");
      // save_edit_full guarda (save_edit) y devuelve la edición entera, con el estado de cada dato y las fotos nuevas, en
      // un solo viaje (auditoría de viajes, punto 8). null si la edición quedó vacía y se borró.
      const { data, error } = await db.rpc("save_edit_full", { p_listing: id, p_patch: toEditPatch(patch) });
      if (error) throw toDomainError(error);
      return fromEditRow(data as EditRow | null, url);
    },

    async discardEditField(id, field) {
      if (!UUID.test(id)) throw new DomainError(NOT_FOUND, "not_found");
      const { error } = await db.rpc("discard_edit_field", { p_listing: id, p_field: FIELD_COLUMN[field] });
      if (error) throw toDomainError(error);
    },

    async stats(id) {
      if (!UUID.test(id)) throw new DomainError(NOT_FOUND, "not_found");
      const { data, error } = await db.rpc("owner_listing_stats", { p_listing: id });
      if (error) throw toDomainError(error);
      const row = data?.[0];
      return { views: row?.views ?? 0, inquiries: row?.inquiries ?? 0 };
    },

    async ownerActivity() {
      await me();
      const { data, error } = await db.rpc("owner_activity");
      if (error) throw toDomainError(error);
      return data.map((r) => ({ listingId: r.listing_id, publicId: r.public_id, views: r.views, whatsappTaps: r.whatsapp_taps, inquiries: r.inquiries }));
    },

    async deleteDraft(id) {
      if (!UUID.test(id)) throw new DomainError(NOT_FOUND, "not_found");
      const { data, error } = await db.from("listings").delete().eq("id", id).eq("owner_id", await me()).select("id");
      if (error) throw toDomainError(error);
      if (data.length > 0) return;
      const l = await getOwn(id);
      throw new DomainError(discardRefusal(l) ?? NOT_FOUND, l ? "validation" : "not_found");
    },
  };
}
