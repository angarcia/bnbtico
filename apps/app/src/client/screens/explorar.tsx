// Explorar (pantalla 01, maqueta v2; tarjetas flotantes, tanda 1): el mapa arriba a todo el ancho y, flotando encima como
// tarjetas, la píldora de búsqueda, los filtros y «₡ | $», que se esconden al bajar y vuelven al subir. Todo el país con el Caribe primero,
// filtros en la URL, una casa por fila; con llegada y salida, cada tarjeta y su marcador dicen el total orientativo de esas noches.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useId, useRef, useState } from "react";
import { webStore } from "../../data/storage";
import { DATES_FILTER_KEY, PEOPLE_FILTER_KEY, searchDatesValue } from "../../domain/contact-return";
import { costaRicaToday } from "../../domain/dates";
import { nightsBetween, peopleLabel, resultsText, searchSummary, stayLabel } from "../../domain/search";
import { ALL_PROVINCES, SEARCH_MAX_PEOPLE, extrasCount, parseFilters, searchFor, searchToString, stayRange, type ExploreSearch, type Filters } from "../../domain/filters";
import { FX_ATTRIBUTION, fxDayLabel, fxRateLabel } from "../../domain/fx";
import { track } from "../../shared/beacon";
import { CurrencySwitch } from "../../shared/currency-switch";
import { FeatureChoiceContent, FEATURE_CHOICE_NAME, FEATURE_CHOICE_ORDER } from "../../shared/feature-choices";
import { useCurrency } from "../../shared/currency";
import { useFx } from "../../shared/fx";
import { I } from "../../shared/icons";
import { revealClass } from "../motion";
import { useDesktop } from "../desktop";
import { ListingCard } from "../listing-card";
import { SearchHelp } from "../search-help";
import { useListingsCount } from "../own-listings-query";
import { SUPPORT_NUMBERS } from "../support-numbers";
import { isDatesError, listingsQuery, provincesQuery, zoneListingsQuery, zonesQuery } from "../queries";
import { ExploreMap, MapLabel } from "../explore-map";
import type { LatLng } from "../../domain/geo";
import type { SearchListing } from "../../domain/listing";
import { RangeCalendar } from "../../shared/range-calendar";

// El mapa a pantalla completa (`?mapa=1`) va en su trozo: se pide al abrirlo.
// Al final de la lista: en su propio trozo, fuera del JS inicial (lo comparte con Cuenta).
const PublishPromoCard = lazy(() => import("../publish-promo").then((m) => ({ default: m.PublishPromoCard })));
const MapScreen = lazy(() => import("../explore-map-full").then((m) => ({ default: m.MapScreen })));
const MapCard = lazy(() => import("../explore-map-full").then((m) => ({ default: m.MapCard })));
const ZonePicker = lazy(() => import("./buscar").then((m) => ({ default: m.Donde })));
const DesktopFilters = lazy(() => import("./filtros").then((m) => ({ default: m.DesktopFilters })));

const route = getRouteApi("/_tabs/explorar");

const filtersLabel = (n: number) => (n ? `Filtros (${n} ${n === 1 ? "activo" : "activos"})` : "Filtros");

type SearchField = "donde" | "cuando";

function DesktopSearch({ filters, zoneName }: { filters: Filters; zoneName: string | null }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<SearchField | null>(null);
  const [draft, setDraft] = useState(filters);
  const [today] = useState(() => costaRicaToday(Date.now()));
  const group = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusZone = useRef(true);
  const panelId = useId();
  const displayed = panel ? draft : filters;
  const fields = [
    { key: "donde", label: "Lugar", value: filters.zone ? zoneName : filters.prov !== ALL_PROVINCES ? filters.prov : null, icon: I.pin },
    { key: "cuando", label: "Fechas", value: stayLabel(displayed), icon: I.calendar },
  ] as const;

  useEffect(() => {
    if (!panel) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !group.current?.contains(event.target)) setPanel(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [panel]);

  function apply(next: Filters) {
    setPanel(null);
    trigger.current?.focus();
    void navigate({ to: "/explorar", search: searchFor(next), resetScroll: false });
  }

  function changePeople(ppl: number) {
    setPanel(null);
    void navigate({ to: "/explorar", search: searchFor({ ...filters, ppl }), replace: true, resetScroll: false });
  }

  return (
    <div ref={group} className="desktop-search-fields" onKeyDown={(event) => {
      if (event.key !== "Escape" || !panel) return;
      event.stopPropagation();
      setPanel(null);
      trigger.current?.focus();
    }}>
      {fields.map(({ key, label, value, icon: Icon }) => (
        <div className="desktop-search-field" key={key}>
          <button type="button" className="search-pill float-card" aria-expanded={panel === key}
            aria-controls={panel === key ? panelId : undefined} aria-label={value ? `${label}: ${value}` : label}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              focusZone.current = true;
              setDraft(filters);
              setPanel(panel === key ? null : key);
            }}>
            <Icon size={20} />
            <span className="search-pill-text">{value ?? label}</span>
          </button>
          {panel === key && (
            <section id={panelId} aria-label={label} className={`desktop-search-panel desktop-search-panel-${key}`}>
              {key === "donde" ? (
                <Suspense fallback={<p role="status">Cargando zonas…</p>}>
                  <ZonePicker zone={draft.zone} onPick={(zone) => apply({ ...draft, zone })} onClear={() => apply({ ...draft, zone: null, prov: ALL_PROVINCES })} focusOnce={focusZone} />
                </Suspense>
              ) : (
                <>
                  <div className="desktop-search-calendar">
                    <RangeCalendar weekdaysPerMonth today={today} value={draft} onChange={(range) => setDraft({ ...draft, ...range })} />
                  </div>
                  <div className="row between">
                    <button type="button" className="btn-text" onClick={() => apply({ ...draft, arrival: null, departure: null })}>Quitar fechas</button>
                    <button type="button" className="btn btn-primary" disabled={!draft.arrival || !draft.departure} onClick={() => apply(draft)}>Aplicar fechas</button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      ))}
      <div className="desktop-search-people float-card" role="group" aria-label="Personas">
        <I.user size={20} />
        <div className="people-stepper">
          <button type="button" aria-label="Una persona menos" disabled={filters.ppl === 0}
            onClick={() => changePeople(filters.ppl - 1)}>−</button>
          <b className="num" aria-live="polite" aria-label={peopleLabel(filters.ppl) ?? "Sin indicar"}>{filters.ppl || "–"}</b>
          <button type="button" aria-label="Una persona más" disabled={filters.ppl >= SEARCH_MAX_PEOPLE}
            onClick={() => changePeople(filters.ppl + 1)}>+</button>
        </div>
      </div>
    </div>
  );
}

/** La píldora de búsqueda (abre la búsqueda); la comparten la cabecera y el mapa a pantalla completa. */
function SearchPill({ filters: f, zoneName, search }: { filters: Filters; zoneName: string | null; search: ExploreSearch }) {
  const queryClient = useQueryClient();
  const desktop = useDesktop();
  // Las zonas de «¿Dónde?», pedidas al tocar la píldora; la ruta se precarga por `defaultPreload: "intent"`.
  const prefetchZones = () => void queryClient.prefetchQuery(zonesQuery);
  if (desktop) return <DesktopSearch filters={f} zoneName={zoneName} />;
  return (
    <Link to="/explorar/buscar" search={search} className="search-pill float-card" onPointerDown={prefetchZones} onFocus={prefetchZones}>
      <I.search size={22} />
      <span className="search-pill-text">{searchSummary(f, zoneName) ?? "Empiece su búsqueda"}</span>
    </Link>
  );
}

function FiltersLink({ filters: f, search }: { filters: Filters; search: ExploreSearch }) {
  const extras = extrasCount(f);
  return (
    <Link to="/explorar/filtros" search={search} className="chip filters-btn float-card" aria-label={filtersLabel(extras)}>
      <I.sliders size={22} />
      {extras ? <span className="badge badge-ok badge-count num">{extras}</span> : null}
    </Link>
  );
}

/** Cabecera de Explorar, flotando sobre el mapa: la píldora (abre la búsqueda) a todo el ancho (la cuenta es una pestaña, C4);
 *  debajo, los filtros y «₡ | $». Se esconde al bajar con la barra de abajo (`.chrome-hide`). */
function DesktopFeatureFilters({ filters }: { filters: Filters }) {
  const navigate = useNavigate();
  const { data } = useQuery(zoneListingsQuery(filters.zone));
  const available = new Set(data?.flatMap((listing) => listing.features));
  const choices = FEATURE_CHOICE_ORDER.filter((feature) => available.has(feature));
  if (!choices.length) return null;

  return (
    <div className="desktop-feature-filters feature-choices" role="group" aria-label="Qué necesitan">
      {choices.map((feature) => {
        const selected = filters.features.includes(feature);
        const features = selected ? filters.features.filter((key) => key !== feature) : [...filters.features, feature];
        return (
          <button key={feature} type="button" className="chip float-card"
            aria-label={FEATURE_CHOICE_NAME[feature]} aria-pressed={selected}
            onClick={() => void navigate({ to: "/explorar", search: searchFor({ ...filters, features }), resetScroll: false })}>
            <FeatureChoiceContent feature={feature} selected={selected} />
          </button>
        );
      })}
    </div>
  );
}

function ExploreHeader({ filters: f, zoneName, search }: { filters: Filters; zoneName: string | null; search: ExploreSearch }) {
  const desktop = useDesktop();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const extras = extrasCount(f);
  return (
    <header className={desktop ? "explore-top" : "explore-top chrome-hide"}>
      <h1 className="sr-only">Explorar casas</h1>
      <div className="explore-search">
        {desktop && f.zone && (
          <button type="button" className="chip filters-btn float-card" aria-label={filtersLabel(extras)} aria-haspopup="dialog" onClick={() => setFiltersOpen(true)}>
            <I.sliders size={22} />
            {extras > 0 && <span className="badge badge-ok badge-count num">{extras}</span>}
          </button>
        )}
        <SearchPill filters={f} zoneName={zoneName} search={search} />
      </div>
      {!desktop && (
        <div className="chiprow fit">
          <FiltersLink filters={f} search={search} />
          <CurrencySwitch className="float-card" />
        </div>
      )}
      {desktop && f.zone && <DesktopFeatureFilters filters={f} />}
      {desktop && f.zone && filtersOpen && (
        <Suspense fallback={null}>
          <DesktopFilters search={search} onClose={() => setFiltersOpen(false)} />
        </Suspense>
      )}
    </header>
  );
}

/** El sitio del mapa mientras llegan las provincias: la misma caja, para que nada salte al llegar. */
function MapPlaceholder() {
  return <div className="explore-map-pane"><div className="map-box explore-map" aria-hidden="true" /></div>;
}

const NO_LISTINGS: SearchListing[] = [];

function SkeletonGrid() {
  return (
    <div className="listing-grid explore-results skeleton" aria-hidden="true">
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
  const desktop = useDesktop();
  const mapOpen = !desktop && search.mapa === "1";
  // La tarjeta para publicar (A8) no se le enseña a quien ya tiene casas.
  const owner = (useListingsCount().count ?? 0) > 0;
  const mapBox = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
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
  const selectedHouse = desktop ? listings?.find((listing) => listing.publicId === selected) : undefined;
  const reveal = useReveal(!listings, searchToString(searchFor(f)));
  // La hoja de contacto de la ficha arranca con estas personas y fechas (revisión UX A3); en la pestaña, no en la URL de la ficha.
  const stay = stayRange(f);
  const dates = searchDatesValue(stay);
  useEffect(() => {
    const store = webStore("session");
    if (f.ppl > 0) store.setItem(PEOPLE_FILTER_KEY, String(f.ppl));
    else store.removeItem(PEOPLE_FILTER_KEY);
    if (dates) store.setItem(DATES_FILTER_KEY, dates);
    else store.removeItem(DATES_FILTER_KEY);
  }, [f.ppl, dates]);
  const go = (next: Filters) => navigate({ to: "/explorar", search: searchFor(next), replace: true });
  const extras = extrasCount(f);
  // Con llegada y salida, las tarjetas y el mapa enseñan el total orientativo de esas noches (lo calcula la búsqueda).
  const nights = stay ? nightsBetween(stay.from, stay.to) : 0;
  const linkSearch = searchFor(f);
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
      {/* Arriba a todo el ancho, también mientras busca: sin casas no se abre. */}
      <div className="explore-map-pane" data-expanded={desktop && expanded ? "" : undefined}>
      <ExploreMap
        ref={mapBox}
        listings={listings ?? NO_LISTINGS}
        zone={zone}
        nights={nights}
        onOpen={!desktop && listings?.length ? openMap : null}
        onSelect={desktop && listings?.length ? (publicId) => {
          if (publicId) track("map_marker_tap", publicId);
          setSelected(publicId);
        } : undefined}
        selected={selectedHouse?.publicId}
        expanded={desktop && expanded}
        onExpand={desktop ? () => setExpanded((value) => !value) : undefined}
      />
      {selectedHouse && (
        <Suspense fallback={null}>
          <MapCard listing={selectedHouse} nights={nights} onClose={() => {
            mapBox.current?.querySelector<HTMLElement>(".map-price.is-selected")?.focus({ preventScroll: true });
            setSelected(null);
          }} />
        </Suspense>
      )}
      </div>
      <div className="explore-list-pane">
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
          <div className="note note-plain note-col" role="alert">
            <span>Revise las fechas de su búsqueda.</span>
            <button type="button" className="btn btn-outline btn-block" onClick={() => go({ ...f, arrival: null, departure: null })}>
              Quitar fechas
            </button>
          </div>
        ) : isError ? (
          <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div>
        ) : (
          <SkeletonGrid />
        )
      ) : listings.length === 0 ? (
        <SearchHelp filters={f} zoneName={zoneName} number={SUPPORT_NUMBERS.guest} onClear={extras ? () => go(parseFilters({ prov: f.prov }, provinces)) : null} />
      ) : (
        <>
          <div className={`listing-grid explore-results${reveal}`}>
            {listings.map((l, i) => (
              <ListingCard key={l.publicId} listing={l} nights={nights} priority={i === 0} />
            ))}
          </div>
          {!desktop && <MapLabel target={mapBox} hidden={mapOpen} onOpen={() => openMap(null)} />}
          {!owner || SUPPORT_NUMBERS.guest ? (
            <div className="explore-footer-cards">
              {owner ? null : (
                <Suspense fallback={null}>
                  <PublishPromoCard />
                </Suspense>
              )}
              <SearchHelp filters={f} zoneName={zoneName} number={SUPPORT_NUMBERS.guest} />
            </div>
          ) : null}
        </>
      )}
      </div>
      {mapOpen && listings ? (
        <Suspense fallback={null}>
          <MapScreen
            listings={listings}
            zone={zone}
            nights={nights}
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

/** En frío, la búsqueda no espera a las provincias (auditoría de viajes 2026-11-05): sale a la vez, con la provincia de la
 *  URL o todo el país, y `Results` la encuentra en la caché al llegar ellas. Si esa provincia no tuviera casas, solo
 *  sobraría esta petición.
 *  Con una zona en la URL se espera, porque la zona también se valida contra su lista. */
function usePrefetchSearch(search: ExploreSearch, waiting: boolean) {
  const client = useQueryClient();
  const guess =
    waiting && !search.zona
      ? parseFilters(search, search.prov && search.prov !== ALL_PROVINCES ? [search.prov] : [], { today: costaRicaToday(Date.now()) })
      : null;
  const key = guess ? JSON.stringify(listingsQuery(guess).queryKey) : "";
  useEffect(() => {
    if (guess) void client.prefetchQuery(listingsQuery(guess));
    // `guess` es un objeto nuevo en cada render: basta con su clave.
  }, [key]);
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
  usePrefetchSearch(search, !provinces && !isError);
  return (
    <>
      <ExploreHeader filters={f} zoneName={zoneName} search={provinces ? searchFor(f) : search} />
      <div className="explore-layout">
      {isError ? (
        <>
          <MapPlaceholder />
          <div className="note note-arena">No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo.</div>
        </>
      ) : loading ? (
        <>
          <MapPlaceholder />
          <SkeletonGrid />
        </>
      ) : provinces.length === 0 ? (
        <>
          {/* Sin ninguna casa publicada, el mapa de verdad (quieto, centrado en Limón), no solo su caja vacía. */}
          <div className="explore-map-pane"><ExploreMap listings={NO_LISTINGS} zone={null} nights={0} onOpen={null} /></div>
          <section className="card stack">
            <h3>Todavía no hay casas publicadas</h3>
            <p className="small muted">Las primeras casas del Caribe sur están en camino.</p>
          </section>
        </>
      ) : (
        <Results filters={f} provinces={provinces} zoneName={zoneName} zone={zone} />
      )}
      </div>
    </>
  );
}

/** Nota de Explorar en dólares: tipo y día de referencia y, si la fuente del tipo la exige, su atribución al final. */
function UsdNote() {
  const fx = useFx();
  const credit = FX_ATTRIBUTION[fx.source];
  return (
    <p className="xs muted" data-testid="usd-note">
      Dólares solo para orientarle: ≈ {fxRateLabel(fx.crcPerUsd)} por US$1 (tipo de referencia del {fxDayLabel(fx.day)}). Los anfitriones fijan sus precios en colones.
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
