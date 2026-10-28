// Filtros de Explorar, en la URL (prototipo explorar-filtros.js y zona-caribe.js).
// Zona → Alquiler mensual → Para quiénes → Qué necesitan → Precio. Limón por defecto mientras tenga casas; solo provincias con casas.
import * as z from "zod/mini";
import type { Currency } from "./currency";
import { DEFAULT_PROVINCE, FEATURE_LABEL, PROVINCES, parseColones, type Feature } from "./listing";

export const PEOPLE_OPTIONS = [0, 2, 4, 6, 8, 12] as const;
export const BEDS_OPTIONS = [0, 1, 2, 3, 4] as const;
export const ALL_PROVINCES = "Todas";
export const FEATURE_KEYS = Object.keys(FEATURE_LABEL) as Feature[];

export interface Filters {
  prov: string; // provincia o «Todas»
  monthly: boolean; // «Alquiler mensual»: solo casas que aceptan alquiler por meses
  ppl: number;
  beds: number;
  features: Feature[];
  min: number; // 0 = sin límite
  max: number;
  open: boolean; // «Más filtros» desplegado (móvil)
}

export type SearchParams = Record<string, unknown>;

// zod/mini: la misma validación con una fracción del peso (este esquema va en el JS inicial de Explorar).
const first = z.pipe(
  z._default(z.unknown(), ""),
  z.transform((v): string => {
    const x = Array.isArray(v) ? v[0] : v;
    return typeof x === "string" || typeof x === "number" ? String(x) : "";
  }),
);
const option = (options: readonly number[]) => z.pipe(first, z.transform((v) => (options.includes(Number(v)) ? Number(v) : 0)));
const flag = z.pipe(first, z.transform((v) => v === "1"));
const money = z.pipe(
  first,
  z.transform((v) => {
    const n = parseColones(v);
    return n === null || Number.isNaN(n) || n < 0 ? 0 : n;
  }),
);

const searchSchema = z.looseObject({
  prov: first,
  mensual: flag,
  // Enlaces viejos (`modo=nightly|monthly|both`): solo `monthly` sigue filtrando, como el mensual.
  modo: z.pipe(first, z.transform((v) => v === "monthly")),
  ppl: option(PEOPLE_OPTIONS),
  beds: option(BEDS_OPTIONS),
  min: money,
  max: money,
  mas: flag,
  ...(Object.fromEntries(FEATURE_KEYS.map((f) => [f, flag])) as Record<Feature, typeof flag>),
});

export function defaultProvince(provinces: readonly string[]): string {
  return provinces.includes(DEFAULT_PROVINCE) ? DEFAULT_PROVINCE : ALL_PROVINCES;
}

export function parseFilters(params: SearchParams, provinces: readonly string[]): Filters {
  const p = searchSchema.parse(params) as z.infer<typeof searchSchema> & Record<Feature, boolean>;
  // Un rango imposible (mínimo > máximo) en la URL se trata como sin rango: Filtros no deja aplicarlo (ticket 15).
  const invalid = priceRangeInvalid(p.min, p.max);
  const min = invalid ? 0 : p.min;
  const max = invalid ? 0 : p.max;
  return {
    prov: p.prov === ALL_PROVINCES || provinces.includes(p.prov) ? p.prov : defaultProvince(provinces),
    monthly: p.mensual || p.modo,
    ppl: p.ppl,
    beds: p.beds,
    features: FEATURE_KEYS.filter((f) => p[f]),
    min,
    max,
    open: p.mas,
  };
}

/** Mínimo mayor que el máximo (con los dos límites puestos). */
export function priceRangeInvalid(min: number, max: number): boolean {
  return min > 0 && max > 0 && min > max;
}

/**
 * Lo escrito en un campo de precio de Filtros, en la moneda elegida, a colones enteros (el dominio y la consulta van en
 * colones). En dólares se convierte con el tipo de referencia; null si está vacío o no es una cifra válida.
 */
export function priceInputToColones(text: string, currency: Currency, fx: number): number | null {
  if (currency === "CRC") {
    const n = parseColones(text);
    return n === null || Number.isNaN(n) || n < 0 ? null : n;
  }
  const raw = text.replace(/[$\s,\u00a0\u202f]/g, "");
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  return Math.round(Number(raw) * fx);
}

/** Un límite en colones tal como se ve en el campo de la moneda elegida ("" sin límite). */
export function colonesToPriceInput(crc: number, currency: Currency, fx: number): string {
  if (!crc) return "";
  return String(currency === "USD" ? Math.round(crc / fx) : crc);
}

/** Solo lo que difiere del valor por defecto, para enlaces limpios. `open` no viaja: lo pone el botón «Más filtros». */
export function toSearchParams(f: Filters, defaults: { prov: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (f.prov !== defaults.prov) p.set("prov", f.prov);
  if (f.monthly) p.set("mensual", "1");
  if (f.ppl) p.set("ppl", String(f.ppl));
  if (f.beds) p.set("beds", String(f.beds));
  for (const feature of f.features) p.set(feature, "1");
  // El rango viaja aunque el mensual lo oculte: vuelve al quitar el filtro.
  if (f.min) p.set("min", String(f.min));
  if (f.max) p.set("max", String(f.max));
  return p;
}

/** Lo que pregunta la consulta: con el mensual, sin rango de precio (el rango es por noche). */
export function effectiveFilters(f: Filters): Filters {
  return f.monthly ? { ...f, min: 0, max: 0 } : f;
}

/** Filtros activos además de la zona: alimenta el contador de «Más filtros» y decide si el bloque empieza abierto.
 *  El mensual no cuenta (va en la fila de chips) y el rango tampoco mientras el mensual lo deja sin efecto. */
export function extrasCount(f: Filters): number {
  const q = effectiveFilters(f);
  return (q.ppl > 0 ? 1 : 0) + (q.beds > 0 ? 1 : 0) + q.features.length + (q.min > 0 ? 1 : 0) + (q.max > 0 ? 1 : 0);
}

/** Línea de resultados: { count: "2 casas", rest: " aceptan alquiler mensual en Limón" }. */
export function resultsText(n: number, f: Pick<Filters, "prov" | "monthly">): { count: string; rest: string } {
  const one = n === 1;
  const monthly = f.monthly ? (one ? " acepta alquiler mensual" : " aceptan alquiler mensual") : "";
  const zone = f.prov !== ALL_PROVINCES ? ` en ${f.prov}` : "";
  return { count: `${n} ${one ? "casa" : "casas"}`, rest: monthly + zone };
}

/** «Todas» y las provincias con casas, en el orden del prototipo. */
export function provinceChips(provinces: readonly string[]): string[] {
  return [ALL_PROVINCES, ...PROVINCES.filter((p) => provinces.includes(p))];
}

// ---------- Búsqueda en la URL (rutas tipadas de Explorar y Filtros) ----------

export type SearchKey = "prov" | "mensual" | "ppl" | "beds" | "min" | "max" | "mas" | Feature;
/** Parámetros de Explorar tal como viajan en la URL: texto, solo claves conocidas y solo si no son el valor por defecto. */
export type ExploreSearch = Partial<Record<SearchKey, string>>;

/** Valida con el mismo esquema que `parseFilters`. La provincia queda en texto: se contrasta con las provincias con casas
 *  al pintar, porque esa lista llega de la red. */
export function normalizeSearch(params: SearchParams): ExploreSearch {
  const p = searchSchema.parse(params) as z.infer<typeof searchSchema> & Record<Feature, boolean>;
  const out: ExploreSearch = {};
  if (p.prov) out.prov = p.prov;
  if (p.mensual || p.modo) out.mensual = "1";
  if (p.ppl) out.ppl = String(p.ppl);
  if (p.beds) out.beds = String(p.beds);
  for (const f of FEATURE_KEYS) if (p[f]) out[f] = "1";
  if (p.min) out.min = String(p.min);
  if (p.max) out.max = String(p.max);
  if (p.mas) out.mas = "1";
  return out;
}

/** La búsqueda limpia que corresponde a unos filtros (para navegar a Explorar con ellos). */
export function searchFor(f: Filters, provinces: readonly string[]): ExploreSearch {
  return Object.fromEntries(toSearchParams(f, { prov: defaultProvince(provinces) })) as ExploreSearch;
}

/** Query string normal (`?prov=Todas&min=44000`), en el orden de las claves y sin vacíos. */
export function searchToString(search: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function searchFromString(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search));
}
