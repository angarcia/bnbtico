// Filtros (pantalla 02): Zona → Para quiénes → Qué necesitan → Precio; «Ver N casas» cuenta en vivo con la misma consulta.
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BEDS_OPTIONS, PEOPLE_OPTIONS, parseFilters, provinceChips, searchFor, type ExploreSearch, type SearchKey } from "../../domain/filters";
import { FEATURES } from "../../domain/listing";
import { I } from "../../shared/icons";
import { listingsQuery, provincesQuery } from "../queries";

const route = getRouteApi("/_tabs/explorar/filtros");

function FiltrosForm({ provinces, initial }: { provinces: string[]; initial: ExploreSearch }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ExploreSearch>(initial);
  const set = (key: SearchKey, value: string | undefined) => setDraft((d) => ({ ...d, [key]: value }));
  const f = parseFilters(draft, provinces);
  const { data } = useQuery(listingsQuery(f));
  const count = data?.length;
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
          apply();
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
              <input id="f-min" inputMode="numeric" placeholder="₡ 0" aria-label="Precio mínimo por noche" value={draft.min ?? ""} onChange={(e) => set("min", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="f-max">Máximo</label>
              <input id="f-max" inputMode="numeric" placeholder="₡ 150 000" aria-label="Precio máximo por noche" value={draft.max ?? ""} onChange={(e) => set("max", e.target.value)} />
            </div>
          </div>
        </section>
        <div className="sticky-spacer" aria-hidden="true" />
        <div className="sticky-actions">
          <button className="btn btn-primary grow" type="submit">
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
