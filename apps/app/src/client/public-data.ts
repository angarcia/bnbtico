import type { PublicListingsApi } from "../domain/api";
import { createAnonListings } from "../data/postgrest/client";

let api: PublicListingsApi | null = null;

/** Lecturas públicas desde el navegador; se carga bajo demanda (supabase-js no entra en el JS inicial). */
export function publicListings(): PublicListingsApi {
  return (api ??= createAnonListings(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY));
}
