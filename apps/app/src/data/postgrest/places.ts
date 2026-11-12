// Adaptador PostgREST de PlacesApi: las RPCs place_at y zones_near (security definer; los polígonos no salen de la base)
// y la lectura pública de las zonas activas.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlacesApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { toDomainError } from "../../domain/errors";
import { caribeFirst } from "../../domain/zones";

export function createPostgrestPlaces(db: SupabaseClient<Database>): PlacesApi {
  return {
    async placeAt(lat, lng) {
      const { data, error } = await db.rpc("place_at", { p_lat: lat, p_lng: lng });
      if (error) throw toDomainError(error);
      const row = data?.[0];
      return row ? { province: row.province, canton: row.canton, district: row.district, districtCode: row.district_code } : null;
    },

    async zonesNear(lat, lng, km) {
      const { data, error } = await db.rpc("zones_near", { p_lat: lat, p_lng: lng, ...(km === undefined ? {} : { p_km: km }) });
      if (error) throw toDomainError(error);
      return (data ?? []).map((z) => ({ id: z.id, name: z.name, distanceM: z.distance_m }));
    },

    async listZones() {
      const { data, error } = await db
        .from("zones")
        .select("id, name, canton_code, lat, lng")
        .eq("active", true)
        .order("canton_code", { ascending: false })
        .order("name");
      if (error) throw toDomainError(error);
      return caribeFirst((data ?? []).map((z) => ({ id: z.id, name: z.name, cantonCode: z.canton_code, lat: z.lat!, lng: z.lng! })));
    },
  };
}
