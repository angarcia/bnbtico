import Link from "next/link";
import { CurrencyToggle } from "@/components/listing/currency-toggle";
import type { Currency } from "@/lib/currency";
import { ALL_PROVINCES, BEDS_OPTIONS, PEOPLE_OPTIONS, extrasCount, provinceChips, toSearchParams, type Filters } from "@/lib/listings/filters";
import { FEATURES } from "@/lib/listings/schema";
import { FX_CRC_PER_USD } from "@/lib/money";
import { AutoSubmit } from "./auto-submit";

interface Props {
  filters: Filters;
  provinces: string[];
  defaultProv: string;
  count: number;
  currency: Currency;
}

/** Filtros de Explorar (prototipo explorar-filtros.js): Zona → Para quiénes → [Qué necesitan → Precio] plegados en móvil. */
export function ExploreFilters({ filters: f, provinces, defaultProv, count, currency }: Props) {
  const extras = extrasCount(f);
  const open = f.open || extras > 0;
  const base = toSearchParams(f, { prov: defaultProv });
  const href = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(base);
    mutate(p);
    const q = p.toString();
    return q ? `/explorar?${q}` : "/explorar";
  };
  const currentHref = href((p) => {
    if (open) p.set("mas", "1");
  });
  const resultsLine = `${count} ${count === 1 ? "casa" : "casas"}${f.prov !== ALL_PROVINCES ? ` en ${f.prov}` : ""} · precios orientativos, acordalos con el propietario`;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Zona</span>
        <div className="chiprow">
          {provinceChips(provinces).map((prov) => (
            <Link key={prov} href={href((p) => (prov === defaultProv ? p.delete("prov") : p.set("prov", prov)))} className="chip" aria-pressed={f.prov === prov}>
              {prov}
            </Link>
          ))}
        </div>
      </div>

      <form method="get" action="/explorar" className="stack" style={{ gap: 14 }}>
        {f.prov !== defaultProv ? <input type="hidden" name="prov" value={f.prov} /> : null}
        {open ? <input type="hidden" name="mas" value="1" /> : null}
        <AutoSubmit>
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Para quiénes</span>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              <label className="chip" style={{ gap: 6 }} aria-pressed={f.ppl > 0}>
                <span>Personas</span>
                <select name="ppl" defaultValue={f.ppl} aria-label="Personas" style={{ border: 0, background: "transparent", minHeight: 0, padding: 0, width: "auto", fontWeight: 700 }}>
                  {PEOPLE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n ? `${n}+` : "Cualquiera"}</option>
                  ))}
                </select>
              </label>
              <label className="chip" style={{ gap: 6 }} aria-pressed={f.beds > 0}>
                <span>Habitaciones</span>
                <select name="beds" defaultValue={f.beds} aria-label="Habitaciones" style={{ border: 0, background: "transparent", minHeight: 0, padding: 0, width: "auto", fontWeight: 700 }}>
                  {BEDS_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n ? `${n}+` : "Cualquiera"}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {open ? (
            <>
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">Qué necesitan</span>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {FEATURES.map(([key, label]) => (
                    <label key={key} className="chip" aria-pressed={f.features.includes(key)}>
                      <input type="checkbox" name={key} value="1" defaultChecked={f.features.includes(key)} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">Precio por noche</span>
                <div className="row" style={{ gap: 8 }}>
                  <input name="min" inputMode="numeric" placeholder="Mín ₡" aria-label="Precio mínimo por noche" defaultValue={f.min || ""} />
                  <input name="max" inputMode="numeric" placeholder="Máx ₡" aria-label="Precio máximo por noche" defaultValue={f.max || ""} />
                  <button className="btn btn-ghost" type="submit">Aplicar</button>
                </div>
              </div>
            </>
          ) : null}
        </AutoSubmit>
      </form>

      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Link href={href((p) => (open ? p.delete("mas") : p.set("mas", "1")))} className="chip" style={{ fontWeight: 700 }} aria-expanded={open}>
          {open ? "Menos filtros" : "Más filtros"}
          {extras ? <span className="badge badge-ok">{extras}</span> : null}
        </Link>
        {extras ? <Link href={href((p) => { for (const k of [...p.keys()]) if (k !== "prov") p.delete(k); })} className="btn-link xs">Limpiar</Link> : null}
      </div>

      <div className="row between" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span className="small muted"><b className="num">{count}</b>{resultsLine.slice(String(count).length)}</span>
        <CurrencyToggle currency={currency} next={currentHref} />
      </div>
      {currency === "USD" ? <p className="xs muted">Precios convertidos a dólares solo para orientarte (≈ ₡{FX_CRC_PER_USD} por US$1). Los propietarios fijan sus precios en colones.</p> : null}
    </div>
  );
}
