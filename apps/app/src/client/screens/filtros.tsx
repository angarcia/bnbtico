// Filtros (pantalla 02): Zona y Fechas abren la búsqueda; Personas, Habitaciones y Tipo se ajustan aquí. «Ver N casas» cuenta en vivo.
// Sin pastillas de provincia desde el ticket 06 (2026-11-06): sin zona es todo el país, con el Caribe primero.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { stayLabel } from "../../domain/search";
import { FX_INITIAL, type FxRate } from "../../domain/fx";
import { useCurrency } from "../../shared/currency";
import { CounterRow } from "../../shared/counter-row";
import { FeatureChoiceContent, FEATURE_CHOICE_NAME, FEATURE_CHOICE_ORDER } from "../../shared/feature-choices";
import { fxQuery } from "../../shared/fx";
import { I } from "../../shared/icons";
import { listingsQuery, provincesQuery, zonesQuery } from "../queries";

const route = getRouteApi("/_tabs/explorar/filtros");
const KIND_FILTER_LABEL = { completo: "Alojamiento completo", habitacion: "Habitación" } as const;

function FiltrosForm({
  provinces,
  initial,
  fx,
}: {
  provinces: string[];
  initial: ExploreSearch;
  fx: FxRate;
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
    today: costaRicaToday(Date.now()),
    zoneIds: zones.data?.map((z) => z.id),
  });
  const zoneName = zones.data?.find((z) => z.id === f.zone)?.name ?? null;
  const badRange = priceRangeInvalid(Number(draft.min ?? 0), Number(draft.max ?? 0));
  const { data } = useQuery(listingsQuery(f));
  const count = data?.length;
  const symbol = currency === "USD" ? "$" : "₡";
  const mineRows = [
    // Una sola fila de zona que dice lo mismo que la búsqueda: «Todas las provincias» sin zona, «Todo Limón» con un ?prov= viejo (A7, ticket 06).
    {
      abrir: "donde",
      label: "Zona",
      icon: I.pin,
      value: f.zone ? (zoneName ?? "") : f.prov === ALL_PROVINCES ? "Todas las provincias" : `Todo ${f.prov}`,
    },
    {
      abrir: "cuando",
      label: "Fechas",
      icon: I.calendar,
      value: stayLabel(f)?.replace(/^desde/, "Desde") ?? "Sin fechas",
    },
  ] as const;
  const setCount = (key: "ppl" | "beds", n: number) => set(key, n ? String(n) : undefined);
  const maxBeds = BEDS_OPTIONS[BEDS_OPTIONS.length - 1]!;
  const apply = () =>
    navigate({
      to: "/explorar",
      search: searchFor(f),
      replace: true,
    });
  return (
    <>
      <header className="header-flow">
        <Link
          to="/explorar"
          search={initial}
          aria-label="Volver"
          className="icon-btn"
        >
          <I.back />
        </Link>
        <h1>Filtros</h1>
        <div className="right">
          <button
            type="button"
            className="btn btn-sm filters-clear"
            onClick={() => {
              setDraft({});
              setPrices({ min: "", max: "" });
            }}
          >
            Limpiar
          </button>
        </div>
      </header>
      <form
        className="stack filters-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!badRange) void apply();
        }}
      >
        <section className="stack" role="group" aria-labelledby="f-mine">
          <span className="eyebrow" id="f-mine">
            Su búsqueda
          </span>
          <div className="filters-search filter-counters">
            {mineRows.map((r) => (
              <Link
                key={r.abrir}
                to="/explorar/buscar"
                search={{ ...searchFor(f), abrir: r.abrir }}
                className="list-item"
              >
                <r.icon size={22} />
                <span>{r.label}</span>
                <small className="filters-search-value">{r.value}</small>
                <span className="chev">
                  <I.chevron />
                </span>
              </Link>
            ))}
            <CounterRow
              label="Personas"
              icon={<I.users size={22} />}
              value={f.ppl || <span className="muted">–</span>}
              decrease={f.ppl > 0 ? () => setCount("ppl", f.ppl - 1) : undefined}
              increase={f.ppl < SEARCH_MAX_PEOPLE ? () => setCount("ppl", f.ppl + 1) : undefined}
            />
            {/* Tipo de alojamiento (ticket 06): una sola opción; «Alojamiento completo» incluye las casas y apartamentos viejos. */}
            <section className="stack kind-section" role="group" aria-labelledby="f-tipo">
              <span className="eyebrow" id="f-tipo">
                Tipo de alojamiento
              </span>
              <div className="kind-filter">
                {([null, ...KIND_FILTERS] as const).map((kind) => (
                  <button
                    key={kind ?? "cualquiera"}
                    type="button"
                    className="chip"
                    aria-label={kind === null ? "Cualquiera" : KIND_FILTER_LABEL[kind]}
                    aria-pressed={f.kind === kind}
                    onClick={() => setDraft((d) => ({
                      ...d,
                      tipo: kind ?? undefined,
                      beds: kind === "completo" ? d.beds : undefined,
                    }))}
                  >
                    {kind === null ? <I.list size={24} /> : kind === "completo" ? <I.house size={24} /> : <I.bed size={24} />}
                    <span>{kind === null ? "Cualquiera" : kind === "completo" ? "Completo" : KIND_FILTER_LABEL[kind]}</span>
                    <span className="feature-check" aria-hidden="true">
                      {f.kind === kind ? <I.check size={14} /> : null}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            {f.kind === "completo" ? <CounterRow
              label="Dormitorios"
              icon={<I.bed size={22} />}
              value={
                <>
                  <span className="sr-only">{f.beds ? `${f.beds} o más` : "Cualquier cantidad"}</span>
                  <span aria-hidden="true" className={f.beds ? undefined : "muted"}>{f.beds ? `${f.beds}+` : "–"}</span>
                </>
              }
              decrease={f.beds > 0 ? () => setCount("beds", f.beds - 1) : undefined}
              increase={f.beds < maxBeds ? () => setCount("beds", f.beds + 1) : undefined}
            /> : null}
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Qué necesitan</span>
          <div className="feature-choices">
            {FEATURE_CHOICE_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-label={FEATURE_CHOICE_NAME[key]}
                aria-pressed={f.features.includes(key)}
                onClick={() =>
                  set(key, f.features.includes(key) ? undefined : "1")
                }
              >
                <FeatureChoiceContent feature={key} selected={f.features.includes(key)} />
              </button>
            ))}
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Precio</span>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-min">Mínimo</label>
              <input
                id="f-min"
                inputMode="decimal"
                placeholder={`${symbol} 0`}
                aria-label="Precio mínimo por noche"
                aria-invalid={badRange || undefined}
                aria-describedby={currency === "CRC" ? "f-price-help" : undefined}
                value={prices.min}
                onChange={(e) => setPrice("min", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="f-max">Máximo</label>
              <input
                id="f-max"
                inputMode="decimal"
                placeholder={currency === "USD" ? "$ 300" : "₡ 150 000"}
                aria-label="Precio máximo por noche"
                aria-invalid={badRange || undefined}
                aria-describedby={currency === "CRC" ? "f-price-help" : undefined}
                value={prices.max}
                onChange={(e) => setPrice("max", e.target.value)}
              />
            </div>
          </div>
          {currency === "CRC" ? <span className="xs muted" id="f-price-help">En colones (₡). Puede verlos en dólares desde Explorar.</span> : null}
          {badRange ? (
            <p className="field-error" role="alert">
              El precio mínimo no puede ser mayor que el máximo.
            </p>
          ) : null}
        </section>
        <div className="sticky-spacer" aria-hidden="true" />
        <div className="sticky-actions">
          <button
            className="btn btn-primary grow"
            type="submit"
            disabled={badRange}
          >
            {count === undefined
              ? "Ver casas"
              : `Ver ${count} ${count === 1 ? "casa" : "casas"}`}
          </button>
        </div>
      </form>
    </>
  );
}

export function FiltrosScreen() {
  const search = route.useSearch();
  const { data: provinces } = useQuery(provincesQuery);
  // En dólares, los campos se rellenan con el tipo vigente: se espera a tenerlo (si falla la lectura, el inicial).
  const usd = useCurrency() === "USD";
  const fx = useQuery({ ...fxQuery, enabled: usd });
  if (!provinces || (usd && fx.isPending)) return null;
  return (
    <FiltrosForm
      provinces={provinces}
      initial={search}
      fx={fx.data ?? FX_INITIAL}
    />
  );
}
