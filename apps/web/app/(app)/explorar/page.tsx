import { ExploreFilters } from "@/components/explore/filters";
import { ListingCard } from "@/components/listing/listing-card";
import { ScreenTitle } from "@/components/shell";
import { currentCurrency } from "@/lib/currency";
import { defaultProvince, parseFilters } from "@/lib/listings/filters";
import { provincesWithListings, search } from "@/lib/listings/repo";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Explorar" };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Catálogo: Limón por defecto, solo provincias con casas, filtros en la URL, colones con visualización en dólares. */
export default async function Explorar({ searchParams }: { searchParams: Search }) {
  const [db, params, currency] = await Promise.all([supabaseServer(), searchParams, currentCurrency()]);
  if (!db) {
    return (
      <>
        <ScreenTitle title="¿A dónde vas?" />
        <div className="note">Esta pantalla necesita Supabase. En local: <code>pnpm db:start</code>.</div>
      </>
    );
  }
  const provinces = await provincesWithListings(db);
  const filters = parseFilters(params, provinces);
  const listings = provinces.length ? await search(db, filters) : [];
  return (
    <>
      <ScreenTitle title="¿A dónde vas?" />
      {provinces.length === 0 ? (
        <section className="card"><p>Todavía no hay casas publicadas.</p></section>
      ) : (
        <>
          <ExploreFilters filters={filters} provinces={provinces} defaultProv={defaultProvince(provinces)} count={listings.length} currency={currency} />
          {listings.length === 0 ? (
            <div className="card muted">Sin resultados con esos filtros.</div>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {listings.map((l) => (
                <ListingCard key={l.publicId} listing={l} currency={currency} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
