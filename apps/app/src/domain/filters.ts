// Filtros de Explorar, en la URL (prototipo explorar-filtros.js y zona-caribe.js).
// Zona → Para quiénes → Tipo → Qué necesitan → Precio. Sin provincia por defecto: todo el país, con el Caribe primero (lo
// ordena search_listings; ticket 06 de la ronda del 2 nov, rehecho el 2026-11-06). `?prov=` de enlaces viejos sigue filtrando.
// Explorar al estilo Airbnb: `zona`, `llegada`/`salida`, `ppl` de 1 a 50 y `mapa`. Sin modo mensual desde el 2026-11-02:
// `mensual`, `modo` y `desde` de los enlaces viejos se ignoran como cualquier clave desconocida.
// No importa calendar.ts ni inquiry.ts (trozos diferidos): las fechas salen de dates.ts.
import type { Currency } from "./currency";
import { addDays, isoParts } from "./dates";
import type { SearchMode } from "./flags";
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
/** Número de noches en Explorar (`?noches=`, modo noches de las feature flags): de 1 a 90 (decisión 2026-11-17). */
export const NIGHTS_MAX = 90;
/** La salida no puede pasar de hoy + 365. */
export const STAY_MAX_DAYS = 365;
/** Id de una zona: código del cantón y nombre (`704-cocles`). */
export const ZONE_ID = /^[1-7][0-9]{2}-[a-z0-9-]+$/;

/** Área visible del mapa (historia #96), en grados, redondeada hacia fuera a 3 decimales (unos 110 m): gestos casi iguales
 *  dan la misma área y reutilizan la caché, y nunca se queda fuera nada de lo que se ve. */
export interface MapArea {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Filters {
  prov: string; // provincia o «Todas»
  zone: string | null; // id de zona (`704-cocles`); si está, manda sobre la provincia
  area: MapArea | null; // el área del mapa tras moverlo; si está, manda sobre la zona y la provincia (historia #96)
  arrival: string | null; // llegada por noches, con su salida
  departure: string | null;
  nights: number; // 0 = sin indicar, 1–90 (modo noches: sin fechas, estimación por duración)
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
  /** Modo de estancia de las feature flags (`SEARCH_MODE`): fechas, noches o ninguna. Sin él, fechas (como antes). Hace
   *  falta aquí y no solo en `normalizeSearch`: el router mezcla en cada ruta los parámetros crudos de la raíz. */
  mode?: SearchMode;
  /** Feature flag de habitaciones (`FLAGS.rooms`); sin él, encendida (como antes). */
  rooms?: boolean;
}

// Lectura escrita a mano, sin zod (como `parseFavorites` y el paso 1 de publicar): este módulo va en el JS inicial de
// Explorar y de la ficha, y zod/mini sumaba ~5 KB gz allí. De cada clave vale el primer valor (texto o número); el resto, "".
const first = (v: unknown): string => {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" || typeof x === "number" ? String(x) : "";
};
const option = (options: readonly number[], v: string) => (options.includes(Number(v)) ? Number(v) : 0);
const date = (v: string) => (isoParts(v) ? v : "");
const nightsOf = (v: string) => (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= NIGHTS_MAX ? Number(v) : 0);
const people = (v: string) => (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= SEARCH_MAX_PEOPLE ? Number(v) : 0);
const money = (v: string) => {
  const n = parseColones(v);
  return n === null || Number.isNaN(n) || n < 0 ? 0 : n;
};

/** Redondea hacia fuera a 3 decimales (antes, a 6, para que 9.65 no suba a 9.651 por el error de coma flotante). */
const outward = (v: number, up: boolean) => {
  const n = Math.round(v * 1e6) / 1e3;
  return (up ? Math.ceil(n) : Math.floor(n)) / 1e3;
};

/** Los límites del mapa como área de búsqueda; null si no forman un rectángulo válido. */
export function areaOf(b: MapArea): MapArea | null {
  const ok = [b.west, b.south, b.east, b.north].every(Number.isFinite) && b.south >= -90 && b.north <= 90 && b.west >= -180 && b.east <= 180;
  if (!ok || b.west >= b.east || b.south >= b.north) return null;
  return { west: outward(b.west, false), south: outward(b.south, false), east: outward(b.east, true), north: outward(b.north, true) };
}

/** `oeste,sur,este,norte`, como viaja en `?area=`. */
export const areaParam = (a: MapArea): string => [a.west, a.south, a.east, a.north].join(",");

/** `oeste,sur,este,norte` (la URL o `toBBoxString()` de Leaflet) como área redondeada; null si no vale. */
export function parseArea(v: string): MapArea | null {
  const parts = v.split(",");
  if (parts.length !== 4 || parts.some((p) => !/^-?\d+(\.\d+)?$/.test(p))) return null;
  const [west, south, east, north] = parts.map(Number) as [number, number, number, number];
  return areaOf({ west, south, east, north });
}

type Parsed = { prov: string; zona: string; area: MapArea | null; llegada: string; salida: string; noches: number; ppl: number; beds: number; tipo: KindFilter | ""; min: number; max: number; mas: boolean; mapa: boolean } & Record<Feature, boolean>;

/** `rooms` (feature flag de habitaciones, historia #62): apagada, no hay tipo en Filtros (todo es alojamiento completo), así
 *  que `?tipo=` se ignora y el mínimo de dormitorios vale sin `tipo=completo`. */
function parseSearch(params: SearchParams, rooms = true): Parsed {
  const get = (key: string) => first(params[key]);
  const zona = get("zona");
  return {
    prov: get("prov"),
    zona: ZONE_ID.test(zona) ? zona : "",
    area: parseArea(get("area")),
    llegada: date(get("llegada")),
    salida: date(get("salida")),
    noches: nightsOf(get("noches")),
    ppl: people(get("ppl")),
    beds: !rooms || get("tipo") === "completo" ? option(BEDS_OPTIONS, get("beds")) : 0,
    tipo: rooms && (KIND_FILTERS as readonly string[]).includes(get("tipo")) ? (get("tipo") as KindFilter) : "",
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
  const p = parseSearch(params, ctx.rooms ?? true);
  const mode = ctx.mode ?? "dates";
  // Un rango imposible (mínimo > máximo) en la URL se trata como sin rango: Filtros no deja aplicarlo (ticket 15).
  const invalid = priceRangeInvalid(p.min, p.max);
  const min = invalid ? 0 : p.min;
  const max = invalid ? 0 : p.max;
  // Con el área del mapa no hay zona ni provincia: no se aplica un radio oculto que impida explorar fuera de él.
  return {
    prov: !p.area && provinces.includes(p.prov) ? p.prov : ALL_PROVINCES,
    zone: !p.area && p.zona && (!ctx.zoneIds || ctx.zoneIds.includes(p.zona)) ? p.zona : null,
    area: p.area,
    ...(mode === "dates" ? stayFrom(p, ctx.today) : { arrival: null, departure: null }),
    nights: mode === "nights" ? p.noches : 0,
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
  // Una zona elegida en la búsqueda gana al área del mapa (la sustituye); al leer la URL, el área deja la zona fuera.
  if (f.zone) p.set("zona", f.zone);
  else if (f.area) p.set("area", areaParam(f.area));
  else if (f.prov !== ALL_PROVINCES) p.set("prov", f.prov);
  if (f.arrival && f.departure) {
    p.set("llegada", f.arrival);
    p.set("salida", f.departure);
  }
  if (f.nights) p.set("noches", String(f.nights));
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

export type SearchKey = "prov" | "zona" | "area" | "llegada" | "salida" | "noches" | "ppl" | "beds" | "tipo" | "min" | "max" | "mas" | "mapa" | Feature;
/** Parámetros de Explorar tal como viajan en la URL: texto, solo claves conocidas y solo si no son el valor por defecto. */
export type ExploreSearch = Partial<Record<SearchKey, string>>;

/** Valida con la misma lectura que `parseFilters`. La provincia y la zona quedan en texto: se contrastan con las
 *  provincias con casas y las zonas al pintar, porque esas listas llegan de la red. `today` aplica la ventana de fechas.
 *  `mode` (feature flags del build, `SEARCH_MODE`) decide qué estancia vale: en modo noches las fechas de un enlace viejo
 *  se descartan (sin filtro oculto de disponibilidad); en modo fechas, las noches; sin estancia, las dos. */
export function normalizeSearch(params: SearchParams, today?: string, mode: SearchMode = "dates", rooms = true): ExploreSearch {
  const p = parseSearch(params, rooms);
  const out: ExploreSearch = {};
  const stay = stayFrom(p, today);
  if (p.area) out.area = areaParam(p.area);
  else {
    if (p.prov) out.prov = p.prov;
    if (p.zona) out.zona = p.zona;
  }
  if (mode === "dates" && stay.arrival && stay.departure) {
    out.llegada = stay.arrival;
    out.salida = stay.departure;
  }
  if (mode === "nights" && p.noches) out.noches = String(p.noches);
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
