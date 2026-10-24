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
import { DEFAULT_PROVINCE, planStep } from "../../domain/listing";
import { fromListingRow, storagePhotoUrl, toListingUpdate } from "../../domain/rows";

const OWN_COLUMNS = "*, listing_photos(id, path, position)";
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
    return data ? fromListingRow(data, data.listing_photos, url) : null;
  }

  return {
    async listOwn() {
      const { data, error } = await db.from("listings").select(OWN_COLUMNS).eq("owner_id", await me()).order("created_at", { ascending: false });
      if (error) throw toDomainError(error);
      return data.map((row) => fromListingRow(row, row.listing_photos, url));
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
      return data ? fromListingRow(data, data.listing_photos, url) : null;
    },

    async createDraft() {
      const owner = await me();
      const profile = await db.from("profiles").select("phone").eq("id", owner).single();
      if (profile.error) throw toDomainError(profile.error);
      // Nada preseleccionado: tipo, modalidades, números y precios nulos o vacíos hasta que el propietario los elige.
      const { data, error } = await db
        .from("listings")
        .insert({ owner_id: owner, title: "", description: "", province: DEFAULT_PROVINCE, whatsapp_phone: profile.data.phone, accepts_nightly: false, accepts_monthly: null })
        .select("id, public_id")
        .single();
      if (error) throw toDomainError(error);
      return { id: data.id, publicId: data.public_id };
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
      return fromListingRow(data, data.listing_photos, url);
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
