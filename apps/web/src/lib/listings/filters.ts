// Filtros de Explorar, en la URL (prototipo explorar-filtros.js y zona-caribe.js).
// Zona → Para quiénes → Qué necesitan → Precio. Limón por defecto mientras tenga casas; solo provincias con casas.
import { DEFAULT_PROVINCE, FEATURE_LABEL, PROVINCES, parseColones, type Feature } from "./schema";

export const PEOPLE_OPTIONS = [0, 2, 4, 6, 8, 12] as const;
export const BEDS_OPTIONS = [0, 1, 2, 3, 4] as const;
export const ALL_PROVINCES = "Todas";

export interface Filters {
  prov: string; // provincia o «Todas»
  ppl: number;
  beds: number;
  features: Feature[];
  min: number; // 0 = sin límite
  max: number;
  open: boolean; // «Más filtros» desplegado (móvil)
}

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function defaultProvince(provinces: string[]): string {
  return provinces.includes(DEFAULT_PROVINCE) ? DEFAULT_PROVINCE : ALL_PROVINCES;
}

export function parseFilters(params: Params, provinces: string[]): Filters {
  const prov = first(params.prov);
  const money = (v: string) => {
    const n = parseColones(v);
    return n === null || Number.isNaN(n) || n < 0 ? 0 : n;
  };
  const pick = <T extends readonly number[]>(v: string, options: T) => (options as readonly number[]).includes(Number(v)) ? Number(v) : 0;
  let min = money(first(params.min));
  let max = money(first(params.max));
  if (min && max && min > max) [min, max] = [max, min];
  return {
    prov: prov === ALL_PROVINCES || provinces.includes(prov) ? prov : defaultProvince(provinces),
    ppl: pick(first(params.ppl), PEOPLE_OPTIONS),
    beds: pick(first(params.beds), BEDS_OPTIONS),
    features: (Object.keys(FEATURE_LABEL) as Feature[]).filter((f) => first(params[f]) === "1"),
    min,
    max,
    open: first(params.mas) === "1",
  };
}

/** Solo lo que difiere del valor por defecto, para enlaces limpios. `open` no viaja: lo pone el botón «Más filtros». */
export function toSearchParams(f: Filters, defaults: { prov: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (f.prov !== defaults.prov) p.set("prov", f.prov);
  if (f.ppl) p.set("ppl", String(f.ppl));
  if (f.beds) p.set("beds", String(f.beds));
  for (const feature of f.features) p.set(feature, "1");
  if (f.min) p.set("min", String(f.min));
  if (f.max) p.set("max", String(f.max));
  return p;
}

/** Filtros activos además de la zona: alimenta el contador de «Más filtros» y decide si el bloque empieza abierto. */
export function extrasCount(f: Filters): number {
  return (f.ppl > 0 ? 1 : 0) + (f.beds > 0 ? 1 : 0) + f.features.length + (f.min > 0 ? 1 : 0) + (f.max > 0 ? 1 : 0);
}

/** «Todas» y las provincias con casas, en el orden del prototipo. */
export function provinceChips(provinces: string[]): string[] {
  return [ALL_PROVINCES, ...PROVINCES.filter((p) => provinces.includes(p))];
}
