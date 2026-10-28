// Explorar (pantalla 01): Limón por defecto, solo provincias con casas, filtros en la URL, rejilla de dos columnas.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { webStore } from "../../data/storage";
import { PEOPLE_FILTER_KEY } from "../../domain/contact-return";
import { ALL_PROVINCES, extrasCount, parseFilters, resultsText, searchFor, searchToString, type Filters } from "../../domain/filters";
import { MONTHLY_LABEL } from "../../domain/listing";
import { FX_ATTRIBUTION, fxDayLabel, fxRateLabel } from "../../domain/fx";
import { track } from "../../shared/beacon";
import { useCurrency } from "../../shared/currency";
import { useFx } from "../../shared/fx";
import { I } from "../../shared/icons";
import { revealClass } from "../motion";
import { ListingCard } from "../listing-card";
import { SearchHelp } from "../search-help";
import { SUPPORT_NUMBERS } from "../support-numbers";
import { listingsQuery, provincesQuery } from "../queries";
import { RootHeader } from "../chrome";

const route = getRouteApi("/_tabs/explorar");

function Header() {
  return (
    <RootHeader
      title={
        <>
          ¿Para dónde <span className="primary">va</span>?
        </>
      }
    />
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
  // La hoja de contacto de la ficha arranca con estas personas (revisión UX A3); en la pestaña, no en la URL de la ficha.
  useEffect(() => {
    const store = webStore("session");
    if (f.ppl > 0) store.setItem(PEOPLE_FILTER_KEY, String(f.ppl));
    else store.removeItem(PEOPLE_FILTER_KEY);
  }, [f.ppl]);
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
        {/* Una fila sin scroll lateral a 360 px (ticket 16): «Alquiler mensual» y «Más filtros»; las características van en Filtros. */}
        <div className="chiprow fit">
          <button type="button" className="chip" aria-pressed={f.monthly} onClick={() => {
              track("monthly_filter_tap");
              void go({ ...f, monthly: !f.monthly });
            }}
          >
            {MONTHLY_LABEL}
          </button>
          <Link to="/explorar/filtros" search={search} className="chip chip-strong">
            Más filtros{extras ? <span className="badge badge-ok badge-tight">{extras}</span> : null}
          </Link>
        </div>
        <div className="row between small muted">
          <span data-testid="results-count">
            {listings
              ? (() => {
                  const r = resultsText(listings.length, f);
                  return (
                    <>
                      <b className="ink num">{r.count}</b>
                      {r.rest}
                    </>
                  );
                })()
              : "Buscando casas…"}
          </span>
        </div>
        {currency === "USD" ? <UsdNote /> : null}
      </div>
      {!listings ? (
        isError ? <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div> : <SkeletonGrid />
      ) : listings.length === 0 ? (
        <SearchHelp filters={f} number={SUPPORT_NUMBERS.guest} onClear={f.monthly || extras ? () => go(parseFilters({ prov: f.prov }, provinces)) : null} />
      ) : (
        <>
          <div className={`listing-grid${reveal}`}>
            {listings.map((l) => (
              <ListingCard key={l.publicId} listing={l} monthly={f.monthly} />
            ))}
          </div>
          <SearchHelp filters={f} number={SUPPORT_NUMBERS.guest} />
        </>
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
