// Filtros (pantalla 02): Zona y Fechas abren la búsqueda; Personas y Habitaciones se ajustan aquí. «Ver N casas» cuenta en vivo.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BEDS_OPTIONS,
  SEARCH_MAX_PEOPLE,
  colonesToPriceInput,
  parseFilters,
  priceInputToColones,
  priceRangeInvalid,
  provinceChips,
  searchFor,
  type ExploreSearch,
  type SearchKey,
} from "../../domain/filters";
import { costaRicaToday } from "../../domain/dates";
import { stayLabel } from "../../domain/search";
import { FEATURES } from "../../domain/listing";
import {
  FX_INITIAL,
  fxDayLabel,
  fxRateLabel,
  type FxRate,
} from "../../domain/fx";
import { useCurrency } from "../../shared/currency";
import { CounterRow } from "../../shared/counter-row";
import { fxQuery } from "../../shared/fx";
import { I } from "../../shared/icons";
import { listingsQuery, provincesQuery, zonesQuery } from "../queries";

const route = getRouteApi("/_tabs/explorar/filtros");

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
  // Chip de provincia: elegir una provincia quita la zona (la zona manda sobre la provincia).
  const pickProvince = (prov: string) =>
    setDraft((d) => ({ ...d, prov, zona: undefined }));
  const mineRows = [
    // Una sola fila de zona que dice lo mismo que la búsqueda: «Todo Limón» sin zona (revisión UX 2026-10-29, A7).
    {
      abrir: "donde",
      label: "Zona",
      value: f.zone
        ? (zoneName ?? "")
        : f.prov
          ? `Todo ${f.prov}`
          : "Todas las provincias",
    },
    {
      abrir: "cuando",
      label: "Fechas",
      value: stayLabel(f)?.replace(/^desde/, "Desde") ?? "Sin fechas",
    },
  ] as const;
  const setCount = (key: "ppl" | "beds", n: number) => set(key, n ? String(n) : undefined);
  const maxBeds = BEDS_OPTIONS[BEDS_OPTIONS.length - 1]!;
  const apply = () =>
    navigate({
      to: "/explorar",
      search: searchFor(f, provinces),
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
                search={{ ...searchFor(f, provinces), abrir: r.abrir }}
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
        {/* Las provincias solo cuando hay casas en más de una; con una (hoy, Limón) la fila «Zona» ya lo dice (A7). Cuando
            haya varias, la provincia pasará a «¿Dónde?», con las zonas agrupadas por provincia. */}
        {provinces.length > 1 ? (
          <section className="stack" role="group" aria-labelledby="f-zona">
            <span className="eyebrow" id="f-zona">
              Zona
            </span>
            <div className="row wrap gap-8">
              {provinceChips(provinces).map((prov) => (
                <button
                  key={prov}
                  type="button"
                  className="chip"
                  aria-pressed={!f.zone && f.prov === prov}
                  onClick={() => pickProvince(prov)}
                >
                  {prov}
                </button>
              ))}
            </div>
            <span className="xs muted">
              Solo aparecen provincias con casas publicadas.
            </span>
          </section>
        ) : null}
        <section className="filter-counters" role="group" aria-label="Personas y habitaciones">
          <CounterRow
            label="Personas"
            icon={<I.users size={22} />}
            value={f.ppl || <span className="muted">–</span>}
            decrease={f.ppl > 0 ? () => setCount("ppl", f.ppl - 1) : undefined}
            increase={f.ppl < SEARCH_MAX_PEOPLE ? () => setCount("ppl", f.ppl + 1) : undefined}
          />
          <CounterRow
            label="Habitaciones"
            icon={<I.bed size={22} />}
            value={
              <>
                <span className="sr-only">{f.beds ? `${f.beds} o más` : "Cualquier cantidad"}</span>
                <span aria-hidden="true" className={f.beds ? undefined : "muted"}>{f.beds ? `${f.beds}+` : "–"}</span>
              </>
            }
            decrease={f.beds > 0 ? () => setCount("beds", f.beds - 1) : undefined}
            increase={f.beds < maxBeds ? () => setCount("beds", f.beds + 1) : undefined}
          />
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
