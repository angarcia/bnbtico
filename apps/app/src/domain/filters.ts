// Filtros de Explorar, en la URL (prototipo explorar-filtros.js y zona-caribe.js).
// Zona → Para quiénes → Qué necesitan → Precio. Limón por defecto mientras tenga casas; solo provincias con casas.
import { z } from "zod";
import { DEFAULT_PROVINCE, FEATURE_LABEL, PROVINCES, parseColones, type Feature } from "./listing";

export const PEOPLE_OPTIONS = [0, 2, 4, 6, 8, 12] as const;
export const BEDS_OPTIONS = [0, 1, 2, 3, 4] as const;
export const ALL_PROVINCES = "Todas";
export const FEATURE_KEYS = Object.keys(FEATURE_LABEL) as Feature[];

export type Mode = "nightly" | "monthly";

export interface Filters {
  prov: string; // provincia o «Todas»
  mode: Mode | null; // Vacacional / Mensual; null = las dos
  ppl: number;
  beds: number;
  features: Feature[];
  min: number; // 0 = sin límite
  max: number;
  open: boolean; // «Más filtros» desplegado (móvil)
}

export type SearchParams = Record<string, unknown>;

const first = z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.union([z.string(), z.number()]).transform(String).catch("")).default("");
const option = (options: readonly number[]) => first.transform((v) => (options.includes(Number(v)) ? Number(v) : 0));
const money = first.transform((v) => {
  const n = parseColones(v);
  return n === null || Number.isNaN(n) || n < 0 ? 0 : n;
});

const searchSchema = z
  .object({
    prov: first,
    modo: first.transform((v): Mode | null => (v === "nightly" || v === "monthly" ? v : null)),
    ppl: option(PEOPLE_OPTIONS),
    beds: option(BEDS_OPTIONS),
    min: money,
    max: money,
    mas: first.transform((v) => v === "1"),
    ...Object.fromEntries(FEATURE_KEYS.map((f) => [f, first.transform((v) => v === "1")])),
  })
  .loose();

export function defaultProvince(provinces: readonly string[]): string {
  return provinces.includes(DEFAULT_PROVINCE) ? DEFAULT_PROVINCE : ALL_PROVINCES;
}

export function parseFilters(params: SearchParams, provinces: readonly string[]): Filters {
  const p = searchSchema.parse(params) as z.infer<typeof searchSchema> & Record<Feature, boolean>;
  let { min, max } = p;
  if (min && max && min > max) [min, max] = [max, min];
  return {
    prov: p.prov === ALL_PROVINCES || provinces.includes(p.prov) ? p.prov : defaultProvince(provinces),
    mode: p.modo,
    ppl: p.ppl,
    beds: p.beds,
    features: FEATURE_KEYS.filter((f) => p[f]),
    min,
    max,
    open: p.mas,
  };
}

/** Solo lo que difiere del valor por defecto, para enlaces limpios. `open` no viaja: lo pone el botón «Más filtros». */
export function toSearchParams(f: Filters, defaults: { prov: string }): URLSearchParams {
  const p = new URLSearchParams();
  if (f.prov !== defaults.prov) p.set("prov", f.prov);
  if (f.mode) p.set("modo", f.mode);
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
export function provinceChips(provinces: readonly string[]): string[] {
  return [ALL_PROVINCES, ...PROVINCES.filter((p) => provinces.includes(p))];
}
