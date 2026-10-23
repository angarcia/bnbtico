// Explorar (pantalla 01): Limón por defecto, solo provincias con casas, filtros en la URL, rejilla de dos columnas.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ALL_PROVINCES, extrasCount, parseFilters, searchFor, searchToString, type Filters } from "../../domain/filters";
import { FEATURE_LABEL, type Feature } from "../../domain/listing";
import { FX_CRC_PER_USD } from "../../domain/money";
import { setCurrency, useCurrency } from "../../shared/currency";
import { I } from "../../shared/icons";
import { revealClass } from "../motion";
import { ListingCard } from "../listing-card";
import { listingsQuery, provincesQuery } from "../queries";
import { useSession } from "../session";

const route = getRouteApi("/_tabs/explorar");
const QUICK: Feature[] = ["pool", "pets", "beachfront"];
const casas = (n: number) => `${n} ${n === 1 ? "casa" : "casas"}`;

function Header() {
  // Caja de tamaño fijo: con sesión (o mientras se lee la guardada) el botón ocupa su sitio sin verse, y nada salta.
  const signedOut = useSession().status === "signed-out";
  return (
    <header className="header-root">
      <div className="top">
        <Link to="/explorar" aria-label="bnbtico, inicio">
          <img className="logo" src="/logo-horizontal.png" alt="bnbtico" width={150} height={38} />
        </Link>
        <Link to="/cuenta" className={`btn btn-ghost btn-header${signedOut ? "" : " is-hidden"}`} aria-hidden={!signedOut} tabIndex={signedOut ? undefined : -1}>
          Ingresar
        </Link>
      </div>
      <h1>
        ¿Para dónde <span className="primary">va</span>?
      </h1>
    </header>
  );
}

function CurrencySwitch() {
  const currency = useCurrency();
  return (
    <div className="row gap-4 currency-switch" role="group" aria-label="Moneda">
      <button type="button" className="link small" aria-pressed={currency === "CRC"} onClick={() => setCurrency("CRC")}>
        ₡ Colones
      </button>
      <span className="small muted">·</span>
      <button type="button" className="link small" aria-pressed={currency === "USD"} onClick={() => setCurrency("USD")}>
        $ Dólares
      </button>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="listing-grid skeleton" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="listing-card">
          <span className="sk photo" />
          <span className="sk sk-line" />
        </div>
      ))}
    </div>
  );
}

function useReveal(loading: boolean, filtersKey: string): string {
  const [firstKey] = useState(filtersKey);
  const waited = useRef(false);
  useEffect(() => {
    if (loading) waited.current = true;
  }, [loading]);
  return revealClass({ loading, waited: waited.current, firstFilters: filtersKey === firstKey });
}

function Results({ filters: f, provinces }: { filters: Filters; provinces: string[] }) {
  const navigate = useNavigate();
  const currency = useCurrency();
  const { data: listings, isError } = useQuery(listingsQuery(f));
  const reveal = useReveal(!listings, searchToString(searchFor(f, provinces)));
  const go = (next: Filters) => navigate({ to: "/explorar", search: searchFor(next, provinces), replace: true });
  const toggleFeature = (key: Feature) => go({ ...f, features: f.features.includes(key) ? f.features.filter((x) => x !== key) : [...f.features, key] });
  const extras = extrasCount(f);
  const search = searchFor(f, provinces);
  const summaryBottom = ["Cualquier fecha", f.ppl ? `${f.ppl}+ personas` : "cualquier grupo", extras ? `${extras} ${extras === 1 ? "filtro" : "filtros"}` : null].filter(Boolean).join(" · ");
  return (
    <>
      <div className="stack explore-head">
        <Link to="/explorar/filtros" search={search} className="row search-pill">
          <I.search size={22} />
          <span className="stack gap-0">
            <b>{f.prov === ALL_PROVINCES ? "Todas las zonas" : f.prov}</b>
            <span className="small muted">{summaryBottom}</span>
          </span>
        </Link>
        <div className="chiprow">
          {(["nightly", "monthly"] as const).map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={f.mode === m} onClick={() => go({ ...f, mode: f.mode === m ? null : m })}>
              {m === "nightly" ? "Vacacional" : "Mensual"}
            </button>
          ))}
          {QUICK.map((key) => (
            <button key={key} type="button" className="chip" aria-pressed={f.features.includes(key)} onClick={() => toggleFeature(key)}>
              {FEATURE_LABEL[key]}
            </button>
          ))}
          <Link to="/explorar/filtros" search={search} className="chip chip-strong">
            Más filtros{extras ? <span className="badge badge-ok badge-tight">{extras}</span> : null}
          </Link>
        </div>
        <div className="row between wrap small muted">
          <span data-testid="results-count">
            {listings ? <b className="ink num">{casas(listings.length)}</b> : "Buscando casas…"}
            {listings && f.prov !== ALL_PROVINCES ? ` en ${f.prov}` : ""}
          </span>
          <CurrencySwitch />
        </div>
        {currency === "USD" ? <p className="xs muted">Precios convertidos a dólares solo para orientarle (≈ ₡{FX_CRC_PER_USD} por US$1). Los propietarios fijan sus precios en colones.</p> : null}
      </div>
      {!listings ? (
        isError ? <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div> : <SkeletonGrid />
      ) : listings.length === 0 ? (
        <div className="card muted">Sin resultados con esos filtros.</div>
      ) : (
        <div className={`listing-grid${reveal}`}>
          {listings.map((l) => (
            <ListingCard key={l.publicId} listing={l} />
          ))}
        </div>
      )}
    </>
  );
}

export function ExplorarScreen() {
  const search = route.useSearch();
  const { data: provinces, isError } = useQuery(provincesQuery);
  return (
    <>
      <Header />
      {!provinces ? (
        isError ? <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div> : <SkeletonGrid />
      ) : provinces.length === 0 ? (
        <section className="card stack">
          <h3>Todavía no hay casas publicadas</h3>
          <p className="small muted">Las primeras casas del Caribe sur están en camino.</p>
        </section>
      ) : (
        <Results filters={parseFilters(search, provinces)} provinces={provinces} />
      )}
    </>
  );
}
