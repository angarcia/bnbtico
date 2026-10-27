// Explorar (pantalla 01): Limón por defecto, solo provincias con casas, filtros en la URL, rejilla de dos columnas.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ALL_PROVINCES, extrasCount, parseFilters, searchFor, searchToString, toggleMode, MODE_CHIPS, type Filters } from "../../domain/filters";
import { FX_ATTRIBUTION, fxDayLabel, fxRateLabel } from "../../domain/fx";
import { useCurrency } from "../../shared/currency";
import { useFx } from "../../shared/fx";
import { CurrencySwitch } from "../currency-switch";
import { I } from "../../shared/icons";
import { revealClass } from "../motion";
import { ListingCard } from "../listing-card";
import { listingsQuery, provincesQuery } from "../queries";
import { useSession } from "../session";

const route = getRouteApi("/_tabs/explorar");
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
  const extras = extrasCount(f);
  const search = searchFor(f, provinces);
  // Sin «Cualquier fecha»: no hay filtro de fechas hasta que los calendarios sean fiables (revisión UX A11).
  const summaryBottom = [f.ppl ? `${f.ppl}+ personas` : "Cualquier grupo", extras ? `${extras} ${extras === 1 ? "filtro" : "filtros"}` : null].filter(Boolean).join(" · ");
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
        {/* Una fila sin scroll lateral a 360 px (ticket 16): modalidad y «Más filtros»; las características van en Filtros. */}
        <div className="chiprow fit">
          {MODE_CHIPS.map(([m, label]) => (
            <button key={m} type="button" className="chip" aria-pressed={f.modes.includes(m)} onClick={() => go({ ...f, modes: toggleMode(f.modes, m) })}>
              {label}
            </button>
          ))}
          <Link to="/explorar/filtros" search={search} className="chip chip-strong">
            Más filtros{extras ? <span className="badge badge-ok badge-tight">{extras}</span> : null}
          </Link>
        </div>
        <div className="row between small muted">
          <span data-testid="results-count">
            {listings ? <b className="ink num">{casas(listings.length)}</b> : "Buscando casas…"}
            {listings && f.prov !== ALL_PROVINCES ? ` en ${f.prov}` : ""}
          </span>
          <CurrencySwitch />
        </div>
        {currency === "USD" ? <UsdNote /> : null}
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

/** Nota de Explorar en dólares: tipo y día de referencia y, si la fuente del tipo la exige, su atribución al final. */
function UsdNote() {
  const fx = useFx();
  const credit = FX_ATTRIBUTION[fx.source];
  return (
    <p className="xs muted" data-testid="usd-note">
      Dólares solo para orientarle: ≈ {fxRateLabel(fx.crcPerUsd)} por US$1 (tipo de referencia del {fxDayLabel(fx.day)}). Los propietarios fijan sus precios en colones.
      {credit ? (
        <>
          {" · "}
          <a href={credit.href} target="_blank" rel="noopener">
            {credit.text}
          </a>
        </>
      ) : null}
    </p>
  );
}
