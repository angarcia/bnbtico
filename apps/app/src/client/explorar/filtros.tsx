// Filtros (pantalla 02): Zona y Fechas abren la búsqueda; Personas, Habitaciones y Tipo se ajustan aquí. «Ver N casas» cuenta en vivo.
// Sin pastillas de provincia desde el ticket 06 (2026-11-06): sin zona es todo el país, con el Caribe primero.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Dialog } from "../../shared/ui/overlay";
import {
  ALL_PROVINCES,
  BEDS_OPTIONS,
  KIND_FILTERS,
  SEARCH_MAX_PEOPLE,
  colonesToPriceInput,
  parseFilters,
  priceInputToColones,
  priceRangeInvalid,
  searchFor,
  type ExploreSearch,
  type SearchKey,
} from "../../domain/filters";
import { costaRicaToday } from "../../domain/dates";
import { housesCount, stayLabel } from "../../domain/search";
import { FX_INITIAL, type FxRate } from "../../domain/fx";
import { useCurrency } from "../../shared/currency";
import { CounterRow } from "../../shared/ui/stepper";
import { ChoiceChips } from "../../shared/ui/choice";
import { AffixInput, Field, StickyActions } from "../../shared/ui/field";
import { FeatureChoiceLabel, FEATURE_CHOICE_NAME, FEATURE_CHOICE_ORDER } from "../../shared/feature-choices";
import { fxQuery } from "../../shared/fx";
import { FLAGS, SEARCH_MODE } from "../../shared/flags";
import { I } from "../../shared/ui/icons";
import { listingsQuery, loadedListings, provincesQuery, zoneListingsQuery, zonesQuery } from "./queries";
import { Button } from "../../shared/ui/button";
import { RouterListRow } from "../comun/router-rows";
import { ScreenHeader } from "../comun/screen-header";
import * as FILTERS_COPY from "./copy/filters";

const route = getRouteApi("/_tabs/explorar/filtros");
const KIND_FILTER_LABEL = { completo: "Alojamiento completo", habitacion: "Habitación" } as const;

function FiltrosForm({
  provinces,
  initial,
  fx,
  onClose,
  titleId,
}: {
  provinces: string[];
  initial: ExploreSearch;
  fx: FxRate;
  onClose?: () => void;
  /** En la ventana de escritorio, el título la nombra (`aria-labelledby`). */
  titleId?: string;
}) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ExploreSearch>(initial);
  const set = (key: SearchKey, value: string | undefined) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const currency = useCurrency();
  // Los precios se escriben en la moneda elegida; la búsqueda guarda colones enteros (ticket 15).
  const [prices, setPrices] = useState(() => ({
    min: colonesToPriceInput(Number(initial.min ?? 0), currency, fx.crcPerUsd),
    max: colonesToPriceInput(Number(initial.max ?? 0), currency, fx.crcPerUsd),
  }));
  const setPrice = (key: "min" | "max", text: string) => {
    setPrices((p) => ({ ...p, [key]: text }));
    const crc = priceInputToColones(text, currency, fx.crcPerUsd);
    set(key, crc ? String(crc) : undefined);
  };
  const zones = useQuery({ ...zonesQuery, enabled: !!draft.zona });
  const f = parseFilters(draft, provinces, {
    mode: SEARCH_MODE,
    rooms: FLAGS.rooms,
    today: costaRicaToday(Date.now()),
    zoneIds: zones.data?.map((z) => z.id),
  });
  const zoneName = zones.data?.find((z) => z.id === f.zone)?.name ?? null;
  const badRange = priceRangeInvalid(Number(draft.min ?? 0), Number(draft.max ?? 0));
  const { data, hasNextPage } = useInfiniteQuery(listingsQuery(f));
  const count = loadedListings(data)?.length;
  const zoneListings = useInfiniteQuery(zoneListingsQuery(f.zone));
  const availableFeatures = new Set(loadedListings(zoneListings.data)?.flatMap((listing) => listing.features));
  const featureChoices = FEATURE_CHOICE_ORDER.filter((key) => availableFeatures.has(key));
  const symbol = currency === "USD" ? "$" : "₡";
  const mineRows = [
    // Una sola fila de zona que dice lo mismo que la búsqueda: «Todas las provincias» sin zona, «Todo Limón» con un ?prov= viejo (A7, ticket 06).
    {
      abrir: "donde",
      label: "Zona",
      icon: I.pin,
      value: f.zone ? (zoneName ?? "") : f.prov === ALL_PROVINCES ? "Todas las provincias" : `Todo ${f.prov}`,
    },
    // Feature flags (#58): la fila de la estancia dice fechas o noches según el modo; sin estancia, no hay fila.
    ...(SEARCH_MODE === "dates"
      ? [{ abrir: "cuando", label: "Fechas", icon: I.calendar, value: stayLabel(f)?.replace(/^desde/, "Desde") ?? "Sin fechas" } as const]
      : SEARCH_MODE === "nights"
        ? [{ abrir: "cuando", label: "Noches", icon: I.moon, value: stayLabel(f) ?? "Sin noches" } as const]
        : []),
  ];
  const setCount = (key: "ppl" | "beds", n: number) => set(key, n ? String(n) : undefined);
  const maxBeds = BEDS_OPTIONS[BEDS_OPTIONS.length - 1]!;
  const apply = async () => {
    await navigate({
      to: "/explorar",
      search: searchFor(f),
      replace: true,
    });
    onClose?.();
  };
  const submit = (
    <Button
      variant="primary"
      size={onClose ? "md" : "lg"}
      block={!!onClose}
      placement={onClose ? undefined : "grow"}
      type="submit"
      disabled={badRange}
    >
      {FILTERS_COPY.seeHouses({ houses: count === undefined ? null : housesCount(count), more: !!hasNextPage })}
    </Button>
  );
  return (
    <>
      <ScreenHeader kind="flow" title={FILTERS_COPY.title} titleId={titleId} {...(onClose ? { close: { label: FILTERS_COPY.close, onClick: onClose } } : { back: { to: "/explorar", search: initial } })} action={
        <div className="right">
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(onClose ? { zona: initial.zona } : {});
              setPrices({ min: "", max: "" });
            }}
          >
            {FILTERS_COPY.reset}
          </Button>
        </div>
      } />
      <form
        className="stack filters-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!badRange) void apply();
        }}
      >
        <section className="stack" role="group" aria-labelledby="f-mine">
          <span className="eyebrow" id="f-mine">
            {FILTERS_COPY.yourSearch}
          </span>
          <div className="filters-search filter-counters">
            {!onClose && mineRows.map((r) => (
              <RouterListRow key={r.abrir} to="/explorar/buscar" search={{ ...searchFor(f), abrir: r.abrir }}>
                <r.icon size={22} />
                <span>{r.label}</span>
                <small className="filters-search-value">{r.value}</small>
                <span className="chev">
                  <I.chevron />
                </span>
              </RouterListRow>
            ))}
            <CounterRow
              label={FILTERS_COPY.people}
              icon={<I.users size={22} />}
              unit="Una persona"
              value={f.ppl}
              min={0}
              max={SEARCH_MAX_PEOPLE}
              empty={!f.ppl}
              onChange={(n) => setCount("ppl", n)}
            />
            {/* Tipo de alojamiento (ticket 06): una sola opción; «Alojamiento completo» incluye las casas y apartamentos viejos.
                Con las habitaciones apagadas (feature flag, #62) todo es alojamiento completo: no hay sección. */}
            {FLAGS.rooms ? (
            <section className="stack kind-section" role="group" aria-labelledby="f-tipo">
              <span className="eyebrow" id="f-tipo">
                {FILTERS_COPY.kind}
              </span>
              <ChoiceChips
                as="button"
                layout="kind"
                options={([null, ...KIND_FILTERS] as const).map((kind) => ({
                  value: kind ?? "cualquiera",
                  name: kind === null ? "Cualquiera" : KIND_FILTER_LABEL[kind],
                  label: (
                    <>
                      {kind === null ? <I.list size={24} /> : kind === "completo" ? <I.house size={24} /> : <I.bed size={24} />}
                      <span>{kind === null ? FILTERS_COPY.anyKind : kind === "completo" ? FILTERS_COPY.whole : KIND_FILTER_LABEL[kind]}</span>
                    </>
                  ),
                }))}
                selected={[f.kind ?? "cualquiera"]}
                onToggle={(value) => {
                  const kind = value === "cualquiera" ? null : value;
                  setDraft((d) => ({ ...d, tipo: kind ?? undefined, beds: kind === "completo" ? d.beds : undefined }));
                }}
              />
            </section>
            ) : null}
            {f.kind === "completo" || !FLAGS.rooms ? <CounterRow
              label={FILTERS_COPY.bedrooms}
              icon={<I.bed size={22} />}
              unit="Un dormitorio"
              value={f.beds}
              min={0}
              max={maxBeds}
              empty={!f.beds}
              display={`${f.beds}+`}
              valueLabel={f.beds ? `${f.beds} o más` : "Cualquier cantidad"}
              onChange={(n) => setCount("beds", n)}
            /> : null}
          </div>
        </section>
        {f.zone && (!zoneListings.data || featureChoices.length > 0) && <section className="stack">
          <span className="eyebrow">{FILTERS_COPY.needs}</span>
          {!zoneListings.data && (zoneListings.isError || zoneListings.isPaused ? (
            <p className="xs muted" role="status">{FILTERS_COPY.featuresError}</p>
          ) : (
            <p className="xs muted" role="status">{FILTERS_COPY.loadingFeatures}</p>
          ))}
          <ChoiceChips
            as="button"
            options={featureChoices.map((key) => ({ value: key, name: FEATURE_CHOICE_NAME[key], label: <FeatureChoiceLabel feature={key} /> }))}
            selected={f.features}
            onToggle={(key) => set(key, f.features.includes(key) ? undefined : "1")}
          />
        </section>}
        <section className="stack">
          <span className="eyebrow">{FILTERS_COPY.price}</span>
          <div className="grid-2">
            {(["min", "max"] as const).map((key) => (
              <Field key={key} id={`f-${key}`} label={key === "min" ? FILTERS_COPY.min : FILTERS_COPY.max} describedBy={badRange ? "f-price-error" : currency === "CRC" ? "f-price-help" : undefined}>
                {(control) => (
                  <AffixInput
                    {...control}
                    size="md"
                    prefix={symbol}
                    inputMode="decimal"
                    placeholder={key === "min" ? "0" : currency === "USD" ? "300" : "150 000"}
                    aria-label={key === "min" ? FILTERS_COPY.minPrice : FILTERS_COPY.maxPrice}
                    aria-invalid={badRange || undefined}
                    value={prices[key]}
                    onChange={(e) => setPrice(key, e.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
          {currency === "CRC" ? <span className="field-hint" id="f-price-help">{FILTERS_COPY.priceHint}</span> : null}
          {badRange ? (
            <p className="field-error" id="f-price-error" role="alert">
              {FILTERS_COPY.badRange}
            </p>
          ) : null}
        </section>
        {onClose ? <div className="desktop-filters-actions">{submit}</div> : <StickyActions>{submit}</StickyActions>}
      </form>
    </>
  );
}

export function FiltrosScreen() {
  const search = route.useSearch();
  return <FiltrosContent search={search} />;
}

function FiltrosContent({ search, onClose, titleId }: { search: ExploreSearch; onClose?: () => void; titleId?: string }) {
  const { data: provinces } = useQuery(provincesQuery);
  // En dólares, los campos se rellenan con el tipo vigente: se espera a tenerlo (si falla la lectura, el inicial).
  const usd = useCurrency() === "USD";
  const fx = useQuery({ ...fxQuery, enabled: usd });
  if (!provinces || (usd && fx.isPending)) return onClose ? <p role="status">{FILTERS_COPY.loading}</p> : null;
  return (
    <FiltrosForm
      provinces={provinces}
      initial={search}
      fx={fx.data ?? FX_INITIAL}
      onClose={onClose}
      titleId={titleId}
    />
  );
}

export function DesktopFilters({ search, onClose }: { search: ExploreSearch; onClose(): void }) {
  const titleId = useId();
  return (
    <Dialog layout="filters" closeButton={false} labelledBy={titleId} onClose={onClose}>
      {({ close }) => (
        <div className="desktop-filters-content">
          <FiltrosContent search={search} titleId={titleId} onClose={close} />
        </div>
      )}
    </Dialog>
  );
}
