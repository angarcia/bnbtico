// Adaptador PostgREST de ListingsApi: el único módulo que conoce supabase-js, los nombres de columnas y las cadenas
// de PostgREST. La autorización la hace la base (RLS y grants); aquí solo se traduce.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicListingsApi } from "../../domain/api";
import type { Database } from "../../domain/database.types";
import { toDomainError } from "../../domain/errors";
import { ALL_PROVINCES, modeFilter, type Filters } from "../../domain/filters";
import { PROVINCES, type LinkState, type PublicListing } from "../../domain/listing";
import { fromDayRow, fromPublicRow, storagePhotoUrl, type PublicRow } from "../../domain/rows";

const PUBLIC_COLUMNS =
  "id, public_id, kind, title, description, province, canton, zone, lat, lng, capacity, bedrooms, bathrooms, bathroom_shared, features, parking_paid, accepts_nightly, nightly_price_crc, min_nights, accepts_monthly, monthly_mode, monthly_price_crc, min_months, available, reopen_at, created_at, updated_at, owner_name, owner_whatsapp_verified, photos";

export const SEARCH_LIMIT = 60;
export const SITEMAP_LIMIT = 1000;

export function createPostgrestListings(db: SupabaseClient<Database>, opts: { supabaseUrl: string }): PublicListingsApi {
  const url = storagePhotoUrl(opts.supabaseUrl);
  const toPublic = (row: PublicRow): PublicListing => fromPublicRow(row, url);

  return {
    async searchPublic(f: Filters) {
      let q = db.from("listings_public").select(PUBLIC_COLUMNS).order("created_at", { ascending: false }).limit(SEARCH_LIMIT);
      // Un anuncio pausado («Anuncio visible» apagado, ticket 20) no sale en Explorar; su ficha sí se abre.
      q = q.eq("available", true);
      if (f.prov !== ALL_PROVINCES) q = q.eq("province", f.prov);
      const mode = modeFilter(f);
      if (mode === "nightly") q = q.eq("accepts_nightly", true);
      if (mode === "monthly") q = q.eq("accepts_monthly", true);
      if (f.ppl) q = q.gte("capacity", f.ppl);
      if (f.beds) q = q.gte("bedrooms", f.beds);
      if (f.features.length) q = q.contains("features", f.features);
      if (f.min) q = q.gte("nightly_price_crc", f.min);
      if (f.max) q = q.lte("nightly_price_crc", f.max);
      const { data, error } = await q;
      if (error) throw toDomainError(error);
      return data.map(toPublic);
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

    async sitemap() {
      const { data, error } = await db.from("listings_public").select("public_id, updated_at").order("updated_at", { ascending: false }).limit(SITEMAP_LIMIT);
      if (error) throw toDomainError(error);
      return data.map((r) => ({ publicId: r.public_id ?? "", updatedAt: r.updated_at ?? "" }));
    },
  };
}
