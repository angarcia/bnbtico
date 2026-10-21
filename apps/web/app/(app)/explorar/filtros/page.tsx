import Link from "next/link";
import { FlowHeader } from "@/components/shell";
import { ALL_PROVINCES, BEDS_OPTIONS, PEOPLE_OPTIONS, defaultProvince, parseFilters, provinceChips, toSearchParams } from "@/lib/listings/filters";
import { provincesWithListings, search } from "@/lib/listings/repo";
import { FEATURES } from "@/lib/listings/schema";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Filtros" };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Filtros (pantalla 02): Zona → Para quiénes → Qué necesitan → Precio; botón fijo «Ver N casas». */
export default async function Filtros({ searchParams }: { searchParams: Search }) {
  const [db, params] = await Promise.all([supabaseServer(), searchParams]);
  const provinces = db ? await provincesWithListings(db) : [];
  const f = parseFilters(params, provinces);
  const count = db && provinces.length ? (await search(db, f)).length : 0;
  const defaultProv = defaultProvince(provinces);
  const back = `/explorar${toSearchParams(f, { prov: defaultProv }).toString() ? `?${toSearchParams(f, { prov: defaultProv })}` : ""}`;
  return (
    <>
      <FlowHeader title="Filtros" back={back} right={<Link href="/explorar" className="link muted">Limpiar</Link>} />
      <form method="get" action="/explorar" className="stack" style={{ gap: 22 }}>
        {f.mode ? <input type="hidden" name="modo" value={f.mode} /> : null}
        <section className="stack">
          <span className="eyebrow">Zona</span>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {provinceChips(provinces).map((prov) => (
              <label key={prov} className="chip" aria-pressed={f.prov === prov} style={{ cursor: "pointer" }}>
                <input type="radio" name="prov" value={prov} defaultChecked={f.prov === prov} className="sr-input" />
                {prov}
              </label>
            ))}
          </div>
          <span className="xs muted">Solo aparecen provincias con casas publicadas.</span>
        </section>
        <section className="stack">
          <span className="eyebrow">Para quiénes</span>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-ppl">Personas</label>
              <select id="f-ppl" name="ppl" defaultValue={f.ppl}>
                {PEOPLE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n ? `${n}+` : "Cualquiera"}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-beds">Habitaciones</label>
              <select id="f-beds" name="beds" defaultValue={f.beds}>
                {BEDS_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n ? `${n}+` : "Cualquiera"}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Qué necesitan</span>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {FEATURES.map(([key, label]) => (
              <label key={key} className="chip" aria-pressed={f.features.includes(key)} style={{ cursor: "pointer" }}>
                <input type="checkbox" name={key} value="1" defaultChecked={f.features.includes(key)} className="sr-input" />
                {label}
              </label>
            ))}
          </div>
        </section>
        <section className="stack">
          <span className="eyebrow">Precio por noche</span>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="f-min">Mínimo</label>
              <input id="f-min" name="min" inputMode="numeric" placeholder="₡ 0" aria-label="Precio mínimo por noche" defaultValue={f.min || ""} />
            </div>
            <div className="field">
              <label htmlFor="f-max">Máximo</label>
              <input id="f-max" name="max" inputMode="numeric" placeholder="₡ 150 000" aria-label="Precio máximo por noche" defaultValue={f.max || ""} />
            </div>
          </div>
        </section>
        <div className="sticky-spacer" aria-hidden="true" />
        <div className="sticky-actions">
          <button className="btn btn-primary grow" type="submit">Ver {count} {count === 1 ? "casa" : "casas"}{f.prov !== ALL_PROVINCES ? "" : ""}</button>
        </div>
      </form>
    </>
  );
}
