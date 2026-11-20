// Explorar (pantalla 01, maqueta v2; tarjetas flotantes, tanda 1): el mapa arriba a todo el ancho y, flotando encima como
// tarjetas, la píldora de búsqueda, los filtros y «₡ | $», que se esconden al bajar y vuelven al subir. Todo el país con el Caribe primero,
// filtros en la URL, una casa por fila; con llegada y salida, cada tarjeta y su marcador dicen el total orientativo de esas noches.
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from "react";
import { webStore } from "../../data/storage";
import { DATES_FILTER_KEY, NIGHTS_FILTER_KEY, PEOPLE_FILTER_KEY, searchDatesValue } from "../../domain/contact-return";
import { costaRicaToday } from "../../domain/dates";
import { durationTotal, nightsBetween, peopleLabel, resultsText, searchSummary, stayLabel } from "../../domain/search";
import { ALL_PROVINCES, SEARCH_MAX_PEOPLE, extrasCount, parseFilters, searchFor, searchToString, stayRange, type ExploreSearch, type Filters } from "../../domain/filters";
import { FX_ATTRIBUTION, fxDayLabel, fxRateLabel } from "../../domain/fx";
import { track } from "../../shared/beacon";
import { CurrencySwitch } from "../../shared/currency-switch";
import { FeatureChoiceLabel, FEATURE_CHOICE_NAME, FEATURE_CHOICE_ORDER } from "../../shared/feature-choices";
import { ChoiceChips } from "../../shared/choice";
import { Stepper } from "../../shared/stepper";
import { useCurrency } from "../../shared/currency";
import { useFx } from "../../shared/fx";
import { FLAGS, SEARCH_MODE } from "../../shared/flags";
import { I } from "../../shared/icons";
import { revealClass } from "../motion";
import { useDesktop } from "../desktop";
import { ListingCard } from "../listing-card";
import { SearchHelp } from "../search-help";
import { useListingsCount } from "../own-listings-query";
import { SUPPORT_NUMBERS } from "../support-numbers";
import { isDatesError, listingsQuery, loadedListings, provincesQuery, zoneListingsQuery, zonesQuery } from "../queries";
import { ExploreMap, MapLabel } from "../explore-map";
import type { LatLng } from "../../domain/geo";
import type { SearchListing } from "../../domain/listing";
import { RangeCalendar } from "../../shared/range-calendar";
import { Button, TextButton } from "../../shared/button";
import { useDismiss } from "../../shared/dismiss";

// El mapa a pantalla completa (`?mapa=1`) va en su trozo: se pide al abrirlo.
// Al final de la lista: en su propio trozo, fuera del JS inicial (lo comparte con Cuenta).
const PublishPromoCard = lazy(() => import("../publish-promo").then((m) => ({ default: m.PublishPromoCard })));
const MapScreen = lazy(() => import("../explore-map-full").then((m) => ({ default: m.MapScreen })));
const MapCard = lazy(() => import("../explore-map-full").then((m) => ({ default: m.MapCard })));
const ZonePicker = lazy(() => import("./buscar").then((m) => ({ default: m.Donde })));
// El contador de noches del panel de escritorio (modo noches): diferido, como la zona; trozo nights-picker-*, que comparte
// con la búsqueda del teléfono y mide su propia entrada de .size-limit.json.
const NightsPicker = lazy(() => import("../../shared/nights-picker").then((m) => ({ default: m.NightsPicker })));
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
  const fields: { key: SearchField; label: string; value: string | null; icon: typeof I.pin }[] = [
    { key: "donde", label: "Lugar", value: filters.zone ? zoneName : filters.prov !== ALL_PROVINCES ? filters.prov : null, icon: I.pin },
    // Feature flags (#58): «Fechas» con fechas, «Noches» con número de noches (diseño #59), ninguno sin estancia.
    ...(SEARCH_MODE === "dates" ? [{ key: "cuando" as const, label: "Fechas", value: stayLabel(displayed), icon: I.calendar }] : []),
    ...(SEARCH_MODE === "nights" ? [{ key: "cuando" as const, label: "Noches", value: stayLabel(displayed), icon: I.moon }] : []),
  ];

  // Escape vuelve al disparador; tocar fuera solo cierra.
  const dismiss = useDismiss({
    open: !!panel,
    inside: () => [group.current],
    onDismiss(reason) {
      setPanel(null);
      if (reason === "escape") trigger.current?.focus();
    },
  });

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
    <div ref={group} className="desktop-search-fields" onKeyDown={dismiss.onKeyDown}>
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
            <section id={panelId} aria-label={label} className={`desktop-search-panel desktop-search-panel-${key === "cuando" && SEARCH_MODE === "nights" ? "noches" : key}`}>
              {key === "donde" ? (
                <Suspense fallback={<p role="status">Cargando zonas…</p>}>
                  <ZonePicker zone={draft.zone} onPick={(zone) => apply({ ...draft, zone })} onClear={() => apply({ ...draft, zone: null, prov: ALL_PROVINCES })} focusOnce={focusZone} />
                </Suspense>
              ) : SEARCH_MODE === "nights" ? (
                <>
                  <Suspense fallback={<p role="status">Cargando…</p>}>
                    <NightsPicker nights={draft.nights} onChange={(nights) => setDraft({ ...draft, nights })} />
                  </Suspense>
                  <div className="row between">
                    <TextButton tone="quiet" onClick={() => apply({ ...draft, nights: 0 })}>Quitar noches</TextButton>
                    <Button variant="primary" disabled={!draft.nights} onClick={() => apply(draft)}>Aplicar noches</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="desktop-search-calendar">
                    <RangeCalendar weekdaysPerMonth today={today} value={draft} onChange={(range) => setDraft({ ...draft, ...range })} />
                  </div>
                  <div className="row between">
                    <TextButton tone="quiet" onClick={() => apply({ ...draft, arrival: null, departure: null })}>Quitar fechas</TextButton>
                    <Button variant="primary" disabled={!draft.arrival || !draft.departure} onClick={() => apply(draft)}>Aplicar fechas</Button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      ))}
      <div className="desktop-search-people float-card" role="group" aria-label="Personas">
        <I.user size={20} />
        <Stepper unit="Una persona" value={filters.ppl} min={0} max={SEARCH_MAX_PEOPLE} empty={!filters.ppl} valueLabel={peopleLabel(filters.ppl) ?? "Sin indicar"} onChange={changePeople} />
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
  const { data } = useInfiniteQuery(zoneListingsQuery(filters.zone));
  const available = new Set(loadedListings(data)?.flatMap((listing) => listing.features));
  const choices = FEATURE_CHOICE_ORDER.filter((feature) => available.has(feature));
  if (!choices.length) return null;

  return (
    <ChoiceChips
      as="button"
      float
      placement="desktop-feature-filters"
      label="Qué necesitan"
      options={choices.map((feature) => ({ value: feature, name: FEATURE_CHOICE_NAME[feature], label: <FeatureChoiceLabel feature={feature} /> }))}
      selected={filters.features}
      onToggle={(feature) => {
        const features = filters.features.includes(feature) ? filters.features.filter((key) => key !== feature) : [...filters.features, feature];
        void navigate({ to: "/explorar", search: searchFor({ ...filters, features }), resetScroll: false });
      }}
    />
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
          <CurrencySwitch placement="float" />
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

/** «Ver más casas» al final de la lista: trae las 60 siguientes (issue #10). Mientras llegan, el botón espera desactivado;
 *  si fallan, se dice encima y el mismo botón reintenta. */
function MoreListings({ loading, failed, onMore }: { loading: boolean; failed: boolean; onMore: () => void }) {
  return (
    <div className="stack gap-8">
      {failed && !loading ? (
        <div className="note note-arena" role="alert">
          No pudimos cargar más casas. Revise su conexión e inténtelo de nuevo.
        </div>
      ) : null}
      <Button variant="primary" block pending={loading} onClick={onMore}>
        {loading ? "Cargando casas…" : "Ver más casas"}
      </Button>
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
  const { data, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery(listingsQuery(f));
  // Todas las páginas ya cargadas («Ver más casas»): la lista y el mapa enseñan las mismas casas.
  // Modo noches (#58/#59): sin fechas, la búsqueda no calcula total; aquí, precio por noche × noches (o la regla mensual).
  const listings = useMemo(() => {
    const loaded = loadedListings(data);
    return loaded && f.nights > 0 ? loaded.map((l) => ({ ...l, stayTotalCrc: durationTotal(l, f.nights) })) : loaded;
  }, [data, f.nights]);
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
    if (f.nights > 0) store.setItem(NIGHTS_FILTER_KEY, String(f.nights));
    else store.removeItem(NIGHTS_FILTER_KEY);
  }, [f.ppl, dates, f.nights]);
  const go = (next: Filters) => navigate({ to: "/explorar", search: searchFor(next), replace: true });
  const extras = extrasCount(f);
  // Con llegada y salida, las tarjetas y el mapa enseñan el total orientativo de esas noches (lo calcula la búsqueda); en
  // modo noches, el de la duración elegida.
  const nights = stay ? nightsBetween(stay.from, stay.to) : f.nights;
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
        // En escritorio, siempre interactivo: sin casas (o mientras busca) se puede seguir moviendo y acercando el mapa, y
        // no se rehace Leaflet al cambiar de casas a ninguna (historia 05 de la revisión 2026-11-17).
        onSelect={desktop ? (publicId) => {
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
                const r = resultsText(listings.length, f, zoneName, hasNextPage);
                return (
                  <>
                    <b className="ink num">{r.count}</b>
                    {r.rest}
                  </>
                );
              })()
            : "Buscando casas…"}
        </span>
        {f.nights > 0 && listings?.length ? (
          <span className="xs muted">Precios orientativos con el precio por noche. El anfitrión le confirma por WhatsApp si está libre.</span>
        ) : null}
        {currency === "USD" ? <UsdNote /> : null}
      </div>
      {!listings ? (
        isDatesError(error) ? (
          <div className="note note-plain note-col" role="alert">
            <span>Revise las fechas de su búsqueda.</span>
            <Button variant="primary" block onClick={() => go({ ...f, arrival: null, departure: null })}>
              Quitar fechas
            </Button>
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
          {hasNextPage ? (
            <MoreListings
              loading={isFetchingNextPage}
              failed={isFetchNextPageError}
              onMore={() => void fetchNextPage()}
            />
          ) : null}
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
      ? parseFilters(search, search.prov && search.prov !== ALL_PROVINCES ? [search.prov] : [], { today: costaRicaToday(Date.now()), mode: SEARCH_MODE, rooms: FLAGS.rooms })
      : null;
  const key = guess ? JSON.stringify(listingsQuery(guess).queryKey) : "";
  useEffect(() => {
    if (guess) void client.prefetchInfiniteQuery(listingsQuery(guess));
    // `guess` es un objeto nuevo en cada render: basta con su clave.
  }, [key]);
}

export function ExplorarScreen() {
  const search = route.useSearch();
  const { data: provinces, isError } = useQuery(provincesQuery);
  const zones = useQuery({ ...zonesQuery, enabled: !!search.zona });
  const f = parseFilters(search, provinces ?? [], { today: costaRicaToday(Date.now()), zoneIds: zones.data?.map((z) => z.id), mode: SEARCH_MODE, rooms: FLAGS.rooms });
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
