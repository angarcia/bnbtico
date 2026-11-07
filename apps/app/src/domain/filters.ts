// Filtros de Explorar, en la URL (prototipo explorar-filtros.js y zona-caribe.js).
// Zona → Para quiénes → Tipo → Qué necesitan → Precio. Sin provincia por defecto: todo el país, con el Caribe primero (lo
// ordena search_listings; ticket 06 de la ronda del 2 nov, rehecho el 2026-11-06). `?prov=` de enlaces viejos sigue filtrando.
// Explorar al estilo Airbnb: `zona`, `llegada`/`salida`, `ppl` de 1 a 50 y `mapa`. Sin modo mensual desde el 2026-11-02:
// `mensual`, `modo` y `desde` de los enlaces viejos se ignoran como cualquier clave desconocida.
// No importa calendar.ts ni inquiry.ts (trozos diferidos): las fechas salen de dates.ts.
import type { Currency } from "./currency";
import { addDays, isoParts } from "./dates";
import { FEATURE_LABEL, parseColones, type Feature, type Kind } from "./listing";

export const BEDS_OPTIONS = [0, 1, 2, 3, 4] as const;
/** Tipo de alojamiento al filtrar (`?tipo=`): «completo» incluye los valores viejos `casa` y `apartamento`. */
export const KIND_FILTERS = ["completo", "habitacion"] as const;
export type KindFilter = (typeof KIND_FILTERS)[number];
/** Los valores de `kind` que cubre cada tipo del filtro. */
export const KINDS_OF_FILTER: Record<KindFilter, readonly Kind[]> = { completo: ["completo", "casa", "apartamento"], habitacion: ["habitacion"] };
export const ALL_PROVINCES = "Todas";
export const FEATURE_KEYS = Object.keys(FEATURE_LABEL) as Feature[];
/** Personas en la búsqueda: las mismas que admite una consulta (INQUIRY_MAX_PEOPLE). */
export const SEARCH_MAX_PEOPLE = 50;
/** La salida no puede pasar de hoy + 365. */
export const STAY_MAX_DAYS = 365;
/** Id de una zona: código del cantón y nombre (`704-cocles`). */
export const ZONE_ID = /^[1-7][0-9]{2}-[a-z0-9-]+$/;

export interface Filters {
  prov: string; // provincia o «Todas»
  zone: string | null; // id de zona (`704-cocles`); si está, manda sobre la provincia
  arrival: string | null; // llegada por noches, con su salida
  departure: string | null;
  ppl: number; // 0 = sin indicar, 1–50
  beds: number;
  kind: KindFilter | null; // null = cualquiera
  features: Feature[];
  min: number; // 0 = sin límite
  max: number;
  open: boolean; // «Más filtros» desplegado (móvil)
}

export type SearchParams = Record<string, unknown>;

/** `today` (Costa Rica) activa la ventana de fechas; sin él, solo forma y orden. `zoneIds` sin definir = aún no han
 *  llegado las zonas: la zona de la URL se conserva. */
export interface ParseContext {
  today?: string;
  zoneIds?: readonly string[];
}

// Lectura escrita a mano, sin zod (como `parseFavorites` y el paso 1 de publicar): este módulo va en el JS inicial de
// Explorar y de la ficha, y zod/mini sumaba ~5 KB gz allí. De cada clave vale el primer valor (texto o número); el resto, "".
const first = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" || typeof x === "number" ? String(x) : "";
};
const option = (options: readonly number[], v: string) => (options.includes(Number(v)) ? Number(v) : 0);
const date = (v: string) => (isoParts(v) ? v : "");
const people = (v: string) => (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= SEARCH_MAX_PEOPLE ? Number(v) : 0);
const money = (v: string) => {
  const n = parseColones(v);
  return n === null || Number.isNaN(n) || n < 0 ? 0 : n;
};

type Parsed = { prov: string; zona: string; llegada: string; salida: string; ppl: number; beds: number; tipo: KindFilter | ""; min: number; max: number; mas: boolean; mapa: boolean } & Record<Feature, boolean>;

function parseSearch(params: SearchParams): Parsed {
  const get = (key: string) => first(params[key]);
  const zona = get("zona");
  return {
    prov: get("prov"),
    zona: ZONE_ID.test(zona) ? zona : "",
    llegada: date(get("llegada")),
    salida: date(get("salida")),
    ppl: people(get("ppl")),
    beds: option(BEDS_OPTIONS, get("beds")),
    tipo: (KIND_FILTERS as readonly string[]).includes(get("tipo")) ? (get("tipo") as KindFilter) : "",
    min: money(get("min")),
    max: money(get("max")),
    mas: get("mas") === "1",
    mapa: get("mapa") === "1",
    ...(Object.fromEntries(FEATURE_KEYS.map((f) => [f, get(f) === "1"])) as Record<Feature, boolean>),
  };
}

/** Las fechas de la URL que valen. Un par inválido (falta una, salida ≤ llegada, llegada antes de hoy o salida después
 *  de hoy + 365) se descarta entero. */
function stayFrom(p: Parsed, today?: string): { arrival: string | null; departure: string | null } {
  const pair = !!p.llegada && !!p.salida && p.salida > p.llegada && (!today || (p.llegada >= today && p.salida <= addDays(today, STAY_MAX_DAYS)));
  return { arrival: pair ? p.llegada : null, departure: pair ? p.salida : null };
}

export function parseFilters(params: SearchParams, provinces: readonly string[], ctx: ParseContext = {}): Filters {
  const p = parseSearch(params);
  // Un rango imposible (mínimo > máximo) en la URL se trata como sin rango: Filtros no deja aplicarlo (ticket 15).
  const invalid = priceRangeInvalid(p.min, p.max);
  const min = invalid ? 0 : p.min;
  const max = invalid ? 0 : p.max;
  return {
    prov: provinces.includes(p.prov) ? p.prov : ALL_PROVINCES,
    zone: p.zona && (!ctx.zoneIds || ctx.zoneIds.includes(p.zona)) ? p.zona : null,
    ...stayFrom(p, ctx.today),
    ppl: p.ppl,
    beds: p.beds,
    kind: p.tipo || null,
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

/** Solo lo que difiere del valor por defecto (todo el país), para enlaces limpios. `open` no viaja: lo pone el botón
 *  «Más filtros»; `mapa` tampoco: lo pone la pantalla del mapa. Con zona, la provincia sobra. */
export function toSearchParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.zone) p.set("zona", f.zone);
  else if (f.prov !== ALL_PROVINCES) p.set("prov", f.prov);
  if (f.arrival && f.departure) {
    p.set("llegada", f.arrival);
    p.set("salida", f.departure);
  }
  if (f.ppl) p.set("ppl", String(f.ppl));
  if (f.beds) p.set("beds", String(f.beds));
  if (f.kind) p.set("tipo", f.kind);
  for (const feature of f.features) p.set(feature, "1");
  if (f.min) p.set("min", String(f.min));
  if (f.max) p.set("max", String(f.max));
  return p;
}

/** Las noches que tienen que estar libres (y que suma el total orientativo), [from, to) = [llegada, salida). */
export function stayRange(f: Pick<Filters, "arrival" | "departure">): { from: string; to: string } | null {
  return f.arrival && f.departure ? { from: f.arrival, to: f.departure } : null;
}

/** Filtros activos además de la búsqueda (zona, fechas y personas): alimenta el contador del botón «Filtros». */
export function extrasCount(f: Filters): number {
  return (f.beds > 0 ? 1 : 0) + (f.kind ? 1 : 0) + f.features.length + (f.min > 0 ? 1 : 0) + (f.max > 0 ? 1 : 0);
}

// ---------- Búsqueda en la URL (rutas tipadas de Explorar y Filtros) ----------

export type SearchKey = "prov" | "zona" | "llegada" | "salida" | "ppl" | "beds" | "tipo" | "min" | "max" | "mas" | "mapa" | Feature;
/** Parámetros de Explorar tal como viajan en la URL: texto, solo claves conocidas y solo si no son el valor por defecto. */
export type ExploreSearch = Partial<Record<SearchKey, string>>;

/** Valida con la misma lectura que `parseFilters`. La provincia y la zona quedan en texto: se contrastan con las
 *  provincias con casas y las zonas al pintar, porque esas listas llegan de la red. `today` aplica la ventana de fechas. */
export function normalizeSearch(params: SearchParams, today?: string): ExploreSearch {
  const p = parseSearch(params);
  const out: ExploreSearch = {};
  const stay = stayFrom(p, today);
  if (p.prov) out.prov = p.prov;
  if (p.zona) out.zona = p.zona;
  if (stay.arrival && stay.departure) {
    out.llegada = stay.arrival;
    out.salida = stay.departure;
  }
  if (p.ppl) out.ppl = String(p.ppl);
  if (p.beds) out.beds = String(p.beds);
  if (p.tipo) out.tipo = p.tipo;
  for (const f of FEATURE_KEYS) if (p[f]) out[f] = "1";
  if (p.min) out.min = String(p.min);
  if (p.max) out.max = String(p.max);
  if (p.mas) out.mas = "1";
  if (p.mapa) out.mapa = "1";
  return out;
}

/** La búsqueda limpia que corresponde a unos filtros (para navegar a Explorar con ellos). */
export function searchFor(f: Filters): ExploreSearch {
  return Object.fromEntries(toSearchParams(f)) as ExploreSearch;
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
