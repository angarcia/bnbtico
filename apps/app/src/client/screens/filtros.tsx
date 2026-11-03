// Filtros (pantalla 02): Su búsqueda (zona, fechas, personas: abren la búsqueda) → Para quiénes (habitaciones y baños) → Tipo de alojamiento → Qué necesitan → Precio; «Ver N casas» cuenta en vivo con la misma consulta.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import {
  ALL_PROVINCES,
  BATHS_OPTIONS,
  BEDS_OPTIONS,
  KIND_FILTERS,
  colonesToPriceInput,
  parseFilters,
  priceInputToColones,
  priceRangeInvalid,
  searchFor,
  type ExploreSearch,
  type SearchKey,
} from "../../domain/filters";
import { costaRicaToday } from "../../domain/dates";
import { peopleLabel, stayLabel } from "../../domain/search";
import { FEATURES, KIND_LABELS } from "../../domain/listing";
import {
  FX_INITIAL,
  fxDayLabel,
  fxRateLabel,
  type FxRate,
} from "../../domain/fx";
import { useCurrency } from "../../shared/currency";
import { fxQuery } from "../../shared/fx";
import { I } from "../../shared/icons";
import { listingsQuery, provincesQuery, zonesQuery } from "../queries";

const route = getRouteApi("/_tabs/explorar/filtros");

// El deslizador y el histograma van en un trozo diferido (Filtros está en el arranque del shell; presupuesto de 150 KB).
const PriceSlider = lazy(() => import("./price-slider").then((m) => ({ default: m.PriceSlider })));

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
  const commitSlider = ({ min, max }: { min: number; max: number }) => {
    const text = (crc: number) => colonesToPriceInput(crc, currency, fx.crcPerUsd);
    setPrice("min", text(min));
    setPrice("max", text(max));
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
  // El histograma sale de la misma búsqueda sin el rango de precio: con el rango vacío es la misma consulta que el conteo
  // (una sola petición); al mover el deslizador solo cambia la del conteo, y esa, al soltar.
  const { data: spread } = useQuery(listingsQuery({ ...f, min: 0, max: 0 }));
  const symbol = currency === "USD" ? "$" : "₡";
  const mineRows = [
    // Una sola fila de zona que dice lo mismo que la búsqueda: sin zona, «Todas las provincias» (un `?prov=` viejo, «Todo Limón»).
    {
      abrir: "donde",
      label: "Zona",
      value: f.zone
        ? (zoneName ?? "")
        : f.prov !== ALL_PROVINCES
          ? `Todo ${f.prov}`
          : "Todas las provincias",
    },
    {
      abrir: "cuando",
      label: "Fechas",
      value: stayLabel(f)?.replace(/^desde/, "Desde") ?? "Sin fechas",
    },
    {
      abrir: "quienes",
      label: "Personas",
      value: peopleLabel(f.ppl) ?? "Sin indicar",
    },
  ] as const;
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
          <Link to="/explorar" className="link muted">
            Limpiar
          </Link>
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
          <div className="list">
            {mineRows.map((r) => (
              <Link
                key={r.abrir}
                to="/explorar/buscar"
                search={{ ...searchFor(f), abrir: r.abrir }}
                className="list-item"
              >
                <span className="body">
                  {r.label}
                  <small>{r.value}</small>
                </span>
                <span className="chev">
                  <I.chevron />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Para quiénes</span>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-beds">Habitaciones</label>
              <select
                id="f-beds"
                value={f.beds}
                onChange={(e) => set("beds", e.target.value)}
              >
                {BEDS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n}+` : "Cualquiera"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-baths">Baños</label>
              <select
                id="f-baths"
                value={f.baths}
                onChange={(e) => set("banos", e.target.value)}
              >
                {BATHS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n}+` : "Cualquiera"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
        <section className="stack" role="group" aria-labelledby="f-tipo">
          <span className="eyebrow" id="f-tipo">
            Tipo de alojamiento
          </span>
          <div className="row wrap gap-8">
            {[null, ...KIND_FILTERS].map((k) => (
              <button
                key={k ?? "cualquiera"}
                type="button"
                className="chip"
                aria-pressed={f.kind === k}
                onClick={() => set("tipo", k ?? undefined)}
              >
                {k ? KIND_LABELS[k] : "Cualquiera"}
              </button>
            ))}
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Qué necesitan</span>
          <div className="row wrap gap-8">
            {FEATURES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="chip"
                aria-pressed={f.features.includes(key)}
                onClick={() =>
                  set(key, f.features.includes(key) ? undefined : "1")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Precio orientativo por noche</span>
          {spread && spread.length ? (
            <Suspense fallback={<div className="price-slider price-slider-wait" aria-hidden="true" />}>
              <PriceSlider
                prices={spread.map((l) => l.nightlyPriceCrc)}
                min={f.min}
                max={f.max}
                currency={currency}
                fx={fx.crcPerUsd}
                onCommit={commitSlider}
              />
            </Suspense>
          ) : null}
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-min">Mínimo</label>
              <input
                id="f-min"
                inputMode="decimal"
                placeholder={`${symbol} 0`}
                aria-label="Precio mínimo por noche"
                aria-invalid={badRange || undefined}
                aria-describedby="f-price-help"
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
                aria-describedby="f-price-help"
                value={prices.max}
                onChange={(e) => setPrice("max", e.target.value)}
              />
            </div>
          </div>
          <span className="xs muted" id="f-price-help">
            {currency === "USD"
              ? `En dólares (${symbol}), solo para orientarle: ≈ ${fxRateLabel(fx.crcPerUsd)} por US$1 (tipo de referencia del ${fxDayLabel(fx.day)}). Los anfitriones fijan sus precios en colones.`
              : `En colones (${symbol}). Puede verlos en dólares desde Explorar.`}
          </span>
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
