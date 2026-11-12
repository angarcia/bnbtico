// Adaptador PostgREST de ListingsApi: el único módulo que conoce supabase-js, los nombres de columnas y las cadenas
// de PostgREST. La autorización la hace la base (RLS y grants); aquí solo se traduce.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicListingsApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { toDomainError } from "../../domain/errors";
import { FX_INITIAL, fromFxRow } from "../../domain/fx";
import { ALL_PROVINCES, KINDS_OF_FILTER, stayRange, type Filters } from "../../domain/filters";
import { PROVINCES, type LinkState, type PublicListing, type SearchListing } from "../../domain/listing";
import { fromDayRow, fromPublicRow, storagePhotoUrl, type PublicRow } from "../../domain/rows";
import { caribeFirst, type ZoneWithListings } from "../../domain/zones";

const PUBLIC_COLUMNS =
  "id, public_id, kind, title, description, province, canton, zone, lat, lng, capacity, bedrooms, bathrooms, bathroom_shared, features, parking_paid, accepts_nightly, nightly_price_crc, min_nights, accepts_monthly, monthly_mode, monthly_price_crc, min_months, available, reopen_at, created_at, updated_at, owner_name, owner_whatsapp_verified, photos";

export const SEARCH_LIMIT = 60;
export const SITEMAP_LIMIT = 1000;

export function createPostgrestListings(db: SupabaseClient<Database>, opts: { supabaseUrl: string }): PublicListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const toPublic = (row: PublicRow): PublicListing => fromPublicRow(row, url);

  return {
    async searchPublic(f: Filters) {
      const r = stayRange(f);
      // Todo lo decide search_listings: zona (5 km con el punto real), noches libres, casas cerradas fuera («Cerrar la casa
      // hasta…» del Calendario, ticket 20; su ficha sí se abre), provincia (solo sin zona), personas, habitaciones, tipo,
      // características y precio por noche; ordena (`sort_rank`: el Caribe primero y luego las más nuevas), limita y solo
      // entonces calcula `stay_total_crc`.
      const { data, error } = await db
        .rpc("search_listings", {
          p_zone: f.zone ?? undefined,
          p_from: r?.from,
          p_to: r?.to,
          p_province: f.prov !== ALL_PROVINCES && !f.zone ? f.prov : undefined,
          p_people: f.ppl || undefined,
          p_bedrooms: f.beds || undefined,
          p_kinds: f.kind ? [...KINDS_OF_FILTER[f.kind]] : undefined,
          p_features: f.features.length ? f.features : undefined,
          p_min: f.min || undefined,
          p_max: f.max || undefined,
          p_limit: SEARCH_LIMIT,
        })
        // PostgREST solo ordena una función `returns table` por una columna que también se pide: sort_rank va en el select.
        .select(`${PUBLIC_COLUMNS}, stay_total_crc, sort_rank`)
        .order("sort_rank");
      if (error) throw toDomainError(error);
      // Los tipos generados dan las columnas de `returns table` como no nulas; el total sí puede ser null.
      return data.map((row): SearchListing => ({ ...toPublic(row), stayTotalCrc: (row.stay_total_crc as number | null) ?? null }));
    },

    async zonesWithListings() {
      const { data, error } = await db.from("zones_with_listings").select("id, name, canton_code, canton, province, lat, lng, listings").order("name");
      if (error) throw toDomainError(error);
      return caribeFirst(
        data.map(
          (z): ZoneWithListings => ({ id: z.id!, name: z.name!, cantonCode: z.canton_code!, canton: z.canton!, province: z.province!, lat: z.lat!, lng: z.lng!, listings: z.listings! }),
        ),
      );
    },

    async getPublic(publicId) {
      const { data, error } = await db.from("listings_public").select(PUBLIC_COLUMNS).eq("public_id", publicId).maybeSingle();
      if (error) throw toDomainError(error);
      return data ? toPublic(data) : null;
    },

    async getManyPublic(publicIds) {
      if (publicIds.length === 0) return [];
      const { data, error } = await db.from("listings_public").select(PUBLIC_COLUMNS).in("public_id", [...new Set(publicIds)]);
      if (error) throw toDomainError(error);
      return data.map(toPublic);
    },

    async linkState(publicId): Promise<LinkState> {
      const { data, error } = await db.rpc("listing_link_state", { p_public_id: publicId });
      if (error) throw toDomainError(error);
      return data === "active" || data === "blocked" ? data : null;
    },

    async provincesWithListings() {
      const { data, error } = await db.from("provinces_with_listings").select("province");
      if (error) throw toDomainError(error);
      const found = new Set(data.map((r) => r.province));
      return PROVINCES.filter((p) => found.has(p));
    },

    async featuresWithListings() {
      const { data, error } = await db.from("features_with_listings").select("feature");
      if (error) throw toDomainError(error);
      return data.flatMap(({ feature }) => feature === null ? [] : [feature]);
    },

    async countActive() {
      const { count, error } = await db.from("listings_public").select("id", { count: "exact", head: true });
      if (error) throw toDomainError(error);
      return count ?? 0;
    },

    async getPublicDays(publicId) {
      const { data, error } = await db.rpc("public_listing_days", { p_public_id: publicId });
      if (error) throw toDomainError(error);
      return data.map(fromDayRow);
    },

    async fxRate() {
      const { data, error } = await db.from("fx_rates").select("day, crc_per_usd, source").order("day", { ascending: false }).limit(1).maybeSingle();
      if (error) throw toDomainError(error);
      return data ? fromFxRow(data) : { ...FX_INITIAL };
    },

    async offerTaken() {
      const { data, error } = await db.rpc("launch_offer_taken");
      if (error) throw toDomainError(error);
      return data ?? 0;
    },

    async blockedReason(publicId) {
      const { data, error } = await db.rpc("listing_blocked_reason", { p_public_id: publicId });
      if (error) throw toDomainError(error);
      return data === "stopped" || data === "payment" || data === "other" ? data : null;
    },

    async sitemap() {
      const { data, error } = await db.from("listings_public").select("public_id, updated_at").order("updated_at", { ascending: false }).limit(SITEMAP_LIMIT);
      if (error) throw toDomainError(error);
      return data.map((r) => ({ publicId: r.public_id ?? "", updatedAt: r.updated_at ?? "" }));
    },
  };
}
