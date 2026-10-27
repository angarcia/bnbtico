// Filtros (pantalla 02): Zona → Para quiénes → Qué necesitan → Precio; «Ver N casas» cuenta en vivo con la misma consulta.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BEDS_OPTIONS, MODE_CHIPS, PEOPLE_OPTIONS, colonesToPriceInput, modeParam, toggleMode, parseFilters, priceInputToColones, priceRangeInvalid, provinceChips, searchFor, type ExploreSearch, type SearchKey } from "../../domain/filters";
import { FEATURES } from "../../domain/listing";
import { FX_CRC_PER_USD } from "../../domain/money";
import { useCurrency } from "../../shared/currency";
import { I } from "../../shared/icons";
import { listingsQuery, provincesQuery } from "../queries";

const route = getRouteApi("/_tabs/explorar/filtros");

function FiltrosForm({ provinces, initial }: { provinces: string[]; initial: ExploreSearch }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ExploreSearch>(initial);
  const set = (key: SearchKey, value: string | undefined) => setDraft((d) => ({ ...d, [key]: value }));
  const currency = useCurrency();
  // Los precios se escriben en la moneda elegida; la búsqueda guarda colones enteros (ticket 15).
  const [prices, setPrices] = useState(() => ({ min: colonesToPriceInput(Number(initial.min ?? 0), currency), max: colonesToPriceInput(Number(initial.max ?? 0), currency) }));
  const setPrice = (key: "min" | "max", text: string) => {
    setPrices((p) => ({ ...p, [key]: text }));
    const crc = priceInputToColones(text, currency);
    set(key, crc ? String(crc) : undefined);
  };
  const f = parseFilters(draft, provinces);
  const badRange = priceRangeInvalid(Number(draft.min ?? 0), Number(draft.max ?? 0));
  const { data } = useQuery(listingsQuery(f));
  const count = data?.length;
  const symbol = currency === "USD" ? "$" : "₡";
  const apply = () => navigate({ to: "/explorar", search: searchFor(f, provinces), replace: true });
  return (
    <>
      <header className="header-flow">
        <Link to="/explorar" search={initial} aria-label="Volver" className="icon-btn">
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
        <section className="stack" role="group" aria-labelledby="f-zona">
          <span className="eyebrow" id="f-zona">
            Zona
          </span>
          <div className="row wrap gap-8">
            {provinceChips(provinces).map((prov) => (
              <button key={prov} type="button" className="chip" aria-pressed={f.prov === prov} onClick={() => set("prov", prov)}>
                {prov}
              </button>
            ))}
          </div>
          <span className="xs muted">Solo aparecen provincias con casas publicadas.</span>
        </section>
        <section className="stack" role="group" aria-labelledby="f-modo">
          <span className="eyebrow" id="f-modo">
            Modalidad
          </span>
          <div className="row wrap gap-8">
            {MODE_CHIPS.map(([m, label]) => (
              <button key={m} type="button" className="chip" aria-pressed={f.modes.includes(m)} onClick={() => set("modo", modeParam(toggleMode(f.modes, m)) ?? undefined)}>
                {label}
              </button>
            ))}
          </div>
          <span className="xs muted">Sin marcar o con las dos, verá todas.</span>
        </section>
        <section className="stack">
          <span className="eyebrow">Para quiénes</span>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-ppl">Personas</label>
              <select id="f-ppl" value={f.ppl} onChange={(e) => set("ppl", e.target.value)}>
                {PEOPLE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n}+` : "Cualquiera"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-beds">Habitaciones</label>
              <select id="f-beds" value={f.beds} onChange={(e) => set("beds", e.target.value)}>
                {BEDS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n ? `${n}+` : "Cualquiera"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Qué necesitan</span>
          <div className="row wrap gap-8">
            {FEATURES.map(([key, label]) => (
              <button key={key} type="button" className="chip" aria-pressed={f.features.includes(key)} onClick={() => set(key, f.features.includes(key) ? undefined : "1")}>
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
              <input id="f-min" inputMode="decimal" placeholder={`${symbol} 0`} aria-label="Precio mínimo por noche" aria-invalid={badRange || undefined} aria-describedby="f-price-help" value={prices.min} onChange={(e) => setPrice("min", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-max">Máximo</label>
              <input id="f-max" inputMode="decimal" placeholder={currency === "USD" ? "$ 300" : "₡ 150 000"} aria-label="Precio máximo por noche" aria-invalid={badRange || undefined} aria-describedby="f-price-help" value={prices.max} onChange={(e) => setPrice("max", e.target.value)} />
            </div>
          </div>
          <span className="xs muted" id="f-price-help">
            {currency === "USD" ? `En dólares (${symbol}), solo para orientarle: ≈ ₡${FX_CRC_PER_USD} por US$1. Los propietarios fijan sus precios en colones.` : `En colones (${symbol}). Puede verlos en dólares desde Explorar o Cuenta.`}
          </span>
          {badRange ? (
            <p className="field-error" role="alert">
              El precio mínimo no puede ser mayor que el máximo.
            </p>
          ) : null}
        </section>
        <div className="sticky-spacer" aria-hidden="true" />
        <div className="sticky-actions">
          <button className="btn btn-primary grow" type="submit" disabled={badRange}>
            {count === undefined ? "Ver casas" : `Ver ${count} ${count === 1 ? "casa" : "casas"}`}
          </button>
        </div>
      </form>
    </>
  );
}

export function FiltrosScreen() {
  const search = route.useSearch();
  const { data: provinces } = useQuery(provincesQuery);
  if (!provinces) return null;
  return <FiltrosForm provinces={provinces} initial={search} />;
}
