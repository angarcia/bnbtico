// Adaptador PostgREST de las casas del propietario. La tabla `listings` solo la leen dueño y admin (RLS); por eso
// listOwn y getOwn filtran además por el usuario de la sesión. Las reglas de estado las aplica la base: aquí solo se
// traduce lo que la base calla (un update o delete filtrado por RLS devuelve cero filas, sin error).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerManageApi } from "../../domain/api";
import { discardRefusal } from "../../domain/can";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { fromListingRow, storagePhotoUrl } from "../../domain/rows";

const OWN_COLUMNS = "*, listing_photos(id, path, position)";
const NOT_FOUND = "No encontramos ese anuncio.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createPostgrestOwnerListings(db: SupabaseClient<Database>, opts: { supabaseUrl: string }): OwnerManageApi {
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

    async setAvailable(id, available) {
      const { error } = await db.rpc("set_listing_available", { p_listing: id, p_available: available });
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
