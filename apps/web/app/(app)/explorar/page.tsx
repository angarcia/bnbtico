import Link from "next/link";
import { ExploreFilters } from "@/components/explore/filters";
import { ListingCard } from "@/components/listing/listing-card";
import { RootHeader } from "@/components/shell";
import { auth } from "@/lib/auth";
import { currentCurrency } from "@/lib/currency";
import { defaultProvince, parseFilters } from "@/lib/listings/filters";
import { provincesWithListings, search } from "@/lib/listings/repo";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Explorar" };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Explorar (pantalla 01): Limón por defecto, solo provincias con casas, filtros en la URL, rejilla de dos columnas. */
export default async function Explorar({ searchParams }: { searchParams: Search }) {
  const [db, params, currency, account] = await Promise.all([supabaseServer(), searchParams, currentCurrency(), (await auth()).current()]);
  const header = (
    <RootHeader
      title={<>¿Para dónde <span className="primary">va</span>?</>}
      home="/explorar"
      action={account ? undefined : <Link href="/cuenta" className="btn btn-ghost" style={{ minHeight: 44, fontSize: 14 }}>Ingresar</Link>}
    />
  );
  if (!db) {
    return (
      <>
        {header}
        <div className="note note-arena">Esta pantalla necesita Supabase. En local: <code>pnpm db:start</code>.</div>
      </>
    );
  }
  const provinces = await provincesWithListings(db);
  const filters = parseFilters(params, provinces);
  const listings = provinces.length ? await search(db, filters) : [];
  return (
    <>
      {header}
      {provinces.length === 0 ? (
        <section className="card stack">
          <h3>Todavía no hay casas publicadas</h3>
          <p className="small muted">Las primeras casas del Caribe sur están en camino.</p>
        </section>
      ) : (
        <>
          <ExploreFilters filters={filters} defaultProv={defaultProvince(provinces)} count={listings.length} currency={currency} />
          {listings.length === 0 ? (
            <div className="card muted">Sin resultados con esos filtros.</div>
          ) : (
            <div className="listing-grid">
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
