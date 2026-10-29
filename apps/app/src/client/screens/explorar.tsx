// Explorar (pantalla 01, maqueta v2): sin barra superior; arriba la píldora de búsqueda y la cuenta, y la fila de chips
// («Solo alquiler mensual», filtros y «₡ | $»), fijas al bajar. Limón por defecto, filtros en la URL, una casa por fila.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { webStore } from "../../data/storage";
import { DATES_FILTER_KEY, PEOPLE_FILTER_KEY, searchDatesValue } from "../../domain/contact-return";
import { costaRicaToday } from "../../domain/dates";
import { resultsText, searchSummary } from "../../domain/search";
import { extrasCount, parseFilters, searchFor, searchToString, stayRange, type ExploreSearch, type Filters } from "../../domain/filters";
import { MONTHLY_FILTER_LABEL } from "../../domain/listing";
import { FX_ATTRIBUTION, fxDayLabel, fxRateLabel } from "../../domain/fx";
import { track } from "../../shared/beacon";
import { CurrencySwitch } from "../../shared/currency-switch";
import { useCurrency } from "../../shared/currency";
import { useFx } from "../../shared/fx";
import { I } from "../../shared/icons";
import { revealClass } from "../motion";
import { ListingCard } from "../listing-card";
import { SearchHelp } from "../search-help";
import { SUPPORT_NUMBERS } from "../support-numbers";
import { isDatesError, listingsQuery, provincesQuery, zonesQuery } from "../queries";
import { AccountButton } from "../chrome";
import { ExploreMap, MapLabel } from "../explore-map";
import type { LatLng } from "../../domain/geo";

// El mapa a pantalla completa (`?mapa=1`) va en su trozo: se pide al abrirlo.
const MapScreen = lazy(() => import("../explore-map-full").then((m) => ({ default: m.MapScreen })));

const route = getRouteApi("/_tabs/explorar");

const filtersLabel = (n: number) => (n ? `Filtros (${n} ${n === 1 ? "activo" : "activos"})` : "Filtros");

/** La píldora de búsqueda (abre la búsqueda); la comparten la cabecera y el mapa a pantalla completa. */
function SearchPill({ filters: f, zoneName, search }: { filters: Filters; zoneName: string | null; search: ExploreSearch }) {
  const queryClient = useQueryClient();
  // Las zonas de «¿Dónde?», pedidas al tocar la píldora; la ruta se precarga por `defaultPreload: "intent"`.
  const prefetchZones = () => void queryClient.prefetchQuery(zonesQuery);
  return (
    <Link to="/explorar/buscar" search={search} className="search-pill" onPointerDown={prefetchZones} onFocus={prefetchZones}>
      <I.search size={22} />
      <span className="search-pill-text">{searchSummary(f, zoneName) ?? "Empiece su búsqueda"}</span>
    </Link>
  );
}

function FiltersLink({ filters: f, search }: { filters: Filters; search: ExploreSearch }) {
  const extras = extrasCount(f);
  return (
    <Link to="/explorar/filtros" search={search} className="chip filters-btn" aria-label={filtersLabel(extras)}>
      <I.sliders size={22} />
      {extras ? <span className="badge badge-ok badge-count num">{extras}</span> : null}
    </Link>
  );
}

/** Cabecera de Explorar: la píldora (abre la búsqueda) y la cuenta; debajo, el mensual, los filtros y «₡ | $». */
function ExploreHeader({ filters: f, zoneName, search }: { filters: Filters; zoneName: string | null; search: ExploreSearch }) {
  const navigate = useNavigate();
  const { data: provinces = [] } = useQuery(provincesQuery);
  return (
    <header className="explore-top">
      <h1 className="sr-only">Explorar casas</h1>
      <div className="explore-search">
        <SearchPill filters={f} zoneName={zoneName} search={search} />
        <AccountButton />
      </div>
      <div className="chiprow fit">
        <button
          type="button"
          className="chip monthly-chip"
          aria-pressed={f.monthly}
          onClick={() => {
            track("monthly_filter_tap");
            void navigate({ to: "/explorar", search: searchFor({ ...f, monthly: !f.monthly }, provinces), replace: true });
          }}
        >
          <span>{MONTHLY_FILTER_LABEL}</span>
        </button>
        <FiltersLink filters={f} search={search} />
        <CurrencySwitch />
      </div>
    </header>
  );
}

function SkeletonGrid() {
  return (
    <div className="listing-grid skeleton" aria-hidden="true">
      {[0, 1, 2].map((i) => (
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

function Results({ filters: f, provinces, zoneName, zone }: { filters: Filters; provinces: string[]; zoneName: string | null; zone: LatLng | null }) {
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const search = route.useSearch();
  const mapOpen = search.mapa === "1";
  const mapBox = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Al cerrar el mapa (botón, «N casas» o Atrás) el foco vuelve a «Mapa» si está a la vista o, si no, a la caja.
  const wasOpen = useRef(mapOpen);
  useEffect(() => {
    if (wasOpen.current && !mapOpen) {
      // También con Atrás del navegador: la próxima vez el mapa se abre sin casa elegida.
      setSelected(null);
      (document.querySelector<HTMLElement>(".map-label") ?? mapBox.current)?.focus({ preventScroll: true });
    }
    wasOpen.current = mapOpen;
  }, [mapOpen]);
  const currency = useCurrency();
  const { data: listings, isError, error } = useQuery(listingsQuery(f));
  const reveal = useReveal(!listings, searchToString(searchFor(f, provinces)));
  // La hoja de contacto de la ficha arranca con estas personas y fechas (revisión UX A3); en la pestaña, no en la URL de la ficha.
  const dates = searchDatesValue(stayRange(f), f.monthly);
  useEffect(() => {
    const store = webStore("session");
    if (f.ppl > 0) store.setItem(PEOPLE_FILTER_KEY, String(f.ppl));
    else store.removeItem(PEOPLE_FILTER_KEY);
    if (dates) store.setItem(DATES_FILTER_KEY, dates);
    else store.removeItem(DATES_FILTER_KEY);
  }, [f.ppl, dates]);
  const go = (next: Filters) => navigate({ to: "/explorar", search: searchFor(next, provinces), replace: true });
  const extras = extrasCount(f);
  const linkSearch = searchFor(f, provinces);
  // Abrir el mapa es una entrada del historial (Atrás lo cierra); la lista no se mueve debajo.
  const openMap = (publicId: string | null) => {
    setSelected(publicId);
    track("explore_map_open");
    if (publicId) track("map_marker_tap", publicId);
    void navigate({ to: "/explorar", search: { ...search, mapa: "1" }, resetScroll: false });
  };
  const closeMap = () => {
    setSelected(null);
    if (canGoBack) router.history.back();
    else void navigate({ to: "/explorar", search: ({ mapa: _mapa, ...rest }: ExploreSearch) => rest, replace: true, resetScroll: false });
  };
  return (
    <>
      <div className="stack gap-4">
        <span className="small muted" data-testid="results-count">
          {listings
            ? (() => {
                const r = resultsText(listings.length, f, zoneName);
                return (
                  <>
                    <b className="ink num">{r.count}</b>
                    {r.rest}
                  </>
                );
              })()
            : "Buscando casas…"}
        </span>
        {currency === "USD" ? <UsdNote /> : null}
      </div>
      {!listings ? (
        isDatesError(error) ? (
          <div className="note note-arena note-col" role="alert">
            <span>Revise las fechas de su búsqueda.</span>
            <button type="button" className="btn btn-outline btn-block" onClick={() => go({ ...f, arrival: null, departure: null, monthlyFrom: null })}>
              Quitar fechas
            </button>
          </div>
        ) : isError ? (
          <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div>
        ) : (
          <SkeletonGrid />
        )
      ) : listings.length === 0 ? (
        <SearchHelp filters={f} zoneName={zoneName} number={SUPPORT_NUMBERS.guest} onClear={f.monthly || extras ? () => go(parseFilters({ prov: f.prov }, provinces)) : null} />
      ) : (
        <>
          <div className={`listing-grid${reveal}`}>
            <ExploreMap ref={mapBox} listings={listings} zone={zone} monthly={f.monthly} onOpen={openMap} />
            {listings.map((l, i) => (
              <ListingCard key={l.publicId} listing={l} monthly={f.monthly} priority={i === 0} />
            ))}
          </div>
          <MapLabel target={mapBox} hidden={mapOpen} onOpen={() => openMap(null)} />
          <SearchHelp filters={f} zoneName={zoneName} number={SUPPORT_NUMBERS.guest} />
        </>
      )}
      {mapOpen && listings ? (
        <Suspense fallback={null}>
          <MapScreen
            listings={listings}
            zone={zone}
            monthly={f.monthly}
            selected={selected}
            onSelect={setSelected}
            onClose={closeMap}
            header={
              <>
                <SearchPill filters={f} zoneName={zoneName} search={linkSearch} />
                <FiltersLink filters={f} search={linkSearch} />
              </>
            }
          />
        </Suspense>
      ) : null}
    </>
  );
}

export function ExplorarScreen() {
  const search = route.useSearch();
  const { data: provinces, isError } = useQuery(provincesQuery);
  const zones = useQuery({ ...zonesQuery, enabled: !!search.zona });
  const f = parseFilters(search, provinces ?? [], { today: costaRicaToday(Date.now()), zoneIds: zones.data?.map((z) => z.id) });
  const zoneRow = zones.data?.find((z) => z.id === f.zone);
  const zoneName = zoneRow?.name ?? null;
  const zone = zoneRow ? { lat: zoneRow.lat, lng: zoneRow.lng } : null;
  const loading = !provinces || (!!search.zona && zones.isPending);
  return (
    <>
      <ExploreHeader filters={f} zoneName={zoneName} search={provinces ? searchFor(f, provinces) : search} />
      {isError ? (
        <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div>
      ) : loading ? (
        <SkeletonGrid />
      ) : provinces.length === 0 ? (
        <section className="card stack">
          <h3>Todavía no hay casas publicadas</h3>
          <p className="small muted">Las primeras casas del Caribe sur están en camino.</p>
        </section>
      ) : (
        <Results filters={f} provinces={provinces} zoneName={zoneName} zone={zone} />
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
