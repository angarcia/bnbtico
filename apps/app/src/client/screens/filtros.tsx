// Filtros (pantalla 02): Zona → Para quiénes → Qué necesitan → Precio; «Ver N casas» cuenta en vivo con la misma consulta.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BEDS_OPTIONS, colonesToPriceInput, parseFilters, priceInputToColones, priceRangeInvalid, provinceChips, searchFor, type ExploreSearch, type SearchKey } from "../../domain/filters";
import { FEATURES, MONTHLY_FILTER_LABEL } from "../../domain/listing";
import { FX_INITIAL, fxDayLabel, fxRateLabel, type FxRate } from "../../domain/fx";
import { useCurrency } from "../../shared/currency";
import { fxQuery } from "../../shared/fx";
import { I } from "../../shared/icons";
import { listingsQuery, provincesQuery } from "../queries";

const route = getRouteApi("/_tabs/explorar/filtros");

function FiltrosForm({ provinces, initial, fx }: { provinces: string[]; initial: ExploreSearch; fx: FxRate }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ExploreSearch>(initial);
  const set = (key: SearchKey, value: string | undefined) => setDraft((d) => ({ ...d, [key]: value }));
  const currency = useCurrency();
  // Los precios se escriben en la moneda elegida; la búsqueda guarda colones enteros (ticket 15).
  const [prices, setPrices] = useState(() => ({ min: colonesToPriceInput(Number(initial.min ?? 0), currency, fx.crcPerUsd), max: colonesToPriceInput(Number(initial.max ?? 0), currency, fx.crcPerUsd) }));
  const setPrice = (key: "min" | "max", text: string) => {
    setPrices((p) => ({ ...p, [key]: text }));
    const crc = priceInputToColones(text, currency, fx.crcPerUsd);
    set(key, crc ? String(crc) : undefined);
  };
  const f = parseFilters(draft, provinces);
  // Con el mensual el rango por noche se oculta y no cuenta: uno inválido escondido no bloquea «Ver N casas».
  const badRange = !f.monthly && priceRangeInvalid(Number(draft.min ?? 0), Number(draft.max ?? 0));
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
        <section className="stack">
          <span className="eyebrow">Para quiénes</span>
          <div className="grid-2">
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
            <button type="button" className="chip" aria-pressed={f.monthly} onClick={() => set("mensual", f.monthly ? undefined : "1")}>
              {MONTHLY_FILTER_LABEL}
            </button>
          </div>
        </section>
        {f.monthly ? null : (
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
              {currency === "USD" ? `En dólares (${symbol}), solo para orientarle: ≈ ${fxRateLabel(fx.crcPerUsd)} por US$1 (tipo de referencia del ${fxDayLabel(fx.day)}). Los propietarios fijan sus precios en colones.` : `En colones (${symbol}). Puede verlos en dólares desde Explorar o Cuenta.`}
            </span>
            {badRange ? (
              <p className="field-error" role="alert">
                El precio mínimo no puede ser mayor que el máximo.
              </p>
            ) : null}
          </section>
        )}
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
  // En dólares, los campos se rellenan con el tipo vigente: se espera a tenerlo (si falla la lectura, el inicial).
  const usd = useCurrency() === "USD";
  const fx = useQuery({ ...fxQuery, enabled: usd });
  if (!provinces || (usd && fx.isPending)) return null;
  return <FiltrosForm provinces={provinces} initial={search} fx={fx.data ?? FX_INITIAL} />;
}
