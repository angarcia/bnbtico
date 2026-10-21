import Link from "next/link";
import { I } from "@/components/icons";
import { CurrencyToggle } from "@/components/listing/currency-toggle";
import type { Currency } from "@/lib/currency";
import { ALL_PROVINCES, extrasCount, toSearchParams, type Filters } from "@/lib/listings/filters";
import { FEATURE_LABEL, type Feature } from "@/lib/listings/schema";
import { FX_CRC_PER_USD } from "@/lib/money";

const QUICK: Feature[] = ["pool", "pets", "beachfront"];

/** Cabecera de Explorar (pantalla 01): buscador-resumen que abre Filtros, chips rápidos y la línea de resultados con la moneda. */
export function ExploreFilters({ filters: f, defaultProv, count, currency }: { filters: Filters; defaultProv: string; count: number; currency: Currency }) {
  const base = toSearchParams(f, { prov: defaultProv });
  const href = (path: string, mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(base);
    mutate(p);
    const q = p.toString();
    return q ? `${path}?${q}` : path;
  };
  const extras = extrasCount(f);
  const currentHref = href("/explorar", () => {});
  const summaryTop = f.prov === ALL_PROVINCES ? "Todas las zonas" : f.prov;
  const summaryBottom = ["Cualquier fecha", f.ppl ? `${f.ppl}+ personas` : "cualquier grupo", extras ? `${extras} ${extras === 1 ? "filtro" : "filtros"}` : null].filter(Boolean).join(" · ");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Link href={href("/explorar/filtros", () => {})} className="row" style={{ gap: 12, minHeight: 56, padding: "0 18px", borderRadius: 999, background: "var(--surface)", boxShadow: "var(--shadow-float)", color: "inherit", textDecoration: "none" }}>
        <I.search size={22} />
        <span className="stack" style={{ gap: 0, lineHeight: 1.15 }}>
          <b>{summaryTop}</b>
          <span className="small muted">{summaryBottom}</span>
        </span>
      </Link>
      <div className="chiprow">
        {(["nightly", "monthly"] as const).map((m) => (
          <Link key={m} href={href("/explorar", (p) => (f.mode === m ? p.delete("modo") : p.set("modo", m)))} className="chip" aria-pressed={f.mode === m}>
            {m === "nightly" ? "Vacacional" : "Mensual"}
          </Link>
        ))}
        {QUICK.map((key) => (
          <Link key={key} href={href("/explorar", (p) => (f.features.includes(key) ? p.delete(key) : p.set(key, "1")))} className="chip" aria-pressed={f.features.includes(key)}>
            {FEATURE_LABEL[key]}
          </Link>
        ))}
        <Link href={href("/explorar/filtros", () => {})} className="chip" style={{ fontWeight: 700 }}>
          Más filtros{extras ? <span className="badge badge-ok" style={{ padding: "2px 8px" }}>{extras}</span> : null}
        </Link>
      </div>
      <div className="row between small muted" style={{ flexWrap: "wrap", gap: 8 }}>
        <span><b className="ink num">{count} {count === 1 ? "casa" : "casas"}</b>{f.prov !== ALL_PROVINCES ? ` en ${f.prov}` : ""}</span>
        <CurrencyToggle currency={currency} next={currentHref} />
      </div>
      {currency === "USD" ? <p className="xs muted">Precios convertidos a dólares solo para orientarle (≈ ₡{FX_CRC_PER_USD} por US$1). Los propietarios fijan sus precios en colones.</p> : null}
    </div>
  );
}
