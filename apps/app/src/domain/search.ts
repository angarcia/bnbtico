// Explorar al estilo Airbnb: el resumen de la búsqueda, la línea de resultados, el rango de llegada y salida del
// calendario de «¿Cuándo?» y las sugerencias de zona de «¿Dónde?». Puro y en el JS inicial: no importa calendar.ts ni
// inquiry.ts (trozos diferidos); las fechas salen de dates.ts.
import { addDays, formatInquiryDates, shortDate } from "./dates";
import { ALL_PROVINCES, MONTHLY_STAY_NIGHTS, type Filters } from "./filters";
import { caribeFirst, norm, type ZoneWithListings } from "./zones";

type StayFilters = Pick<Filters, "monthly" | "arrival" | "departure" | "monthlyFrom">;

/** «23–27 nov» (por noches) o «desde el 1 dic» (mensual); null sin fechas. Cuenta lo que pregunta la consulta: con el
 *  mensual, solo el «desde»; por noches, solo la llegada y la salida. */
export function stayLabel(f: StayFilters): string | null {
  if (f.monthly) {
    const d = f.monthlyFrom ? shortDate(f.monthlyFrom) : null;
    return d ? `desde el ${d}` : null;
  }
  return f.arrival && f.departure ? formatInquiryDates(f.arrival, f.departure) : null;
}

/** «4 personas», «1 persona»; null sin indicar. */
export function peopleLabel(n: number): string | null {
  return n > 0 ? `${n} ${n === 1 ? "persona" : "personas"}` : null;
}

/** La píldora de Explorar: «Cocles · 23–27 nov · 4 personas»; null si no hay nada. */
export function searchSummary(f: Filters, zoneName: string | null): string | null {
  const text = [f.zone ? zoneName : null, stayLabel(f), peopleLabel(f.ppl)].filter(Boolean).join(" · ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}

/** «8 casas», «1 casa»: la cifra de los resultados y la píldora del mapa a pantalla completa. */
export const housesCount = (n: number): string => `${n} ${n === 1 ? "casa" : "casas"}`;

/** Línea de resultados: { count: "4 casas", rest: " en Cocles y alrededores · 23–27 nov" }. */
export function resultsText(n: number, f: StayFilters & Pick<Filters, "prov" | "zone">, zoneName: string | null = null): { count: string; rest: string } {
  const one = n === 1;
  const monthly = f.monthly ? (one ? " acepta alquiler mensual" : " aceptan alquiler mensual") : "";
  const place = f.zone && zoneName ? ` en ${zoneName} y alrededores` : f.prov !== ALL_PROVINCES ? ` en ${f.prov}` : "";
  const stay = stayLabel(f);
  return { count: housesCount(n), rest: monthly + place + (stay ? ` · ${stay}` : "") };
}

export interface RangeState { arrival: string | null; departure: string | null }

/** Un toque en un día del calendario: primero la llegada, luego la salida (posterior); un día igual o anterior a la
 *  llegada la reemplaza, y con el rango completo se empieza de nuevo. */
export function tapRange(s: RangeState, day: string): RangeState {
  if (s.arrival && !s.departure && day > s.arrival) return { arrival: s.arrival, departure: day };
  return { arrival: day, departure: null };
}

/** Noches entre dos fechas `YYYY-MM-DD`. */
export function nightsBetween(arrival: string, departure: string): number {
  return Math.round((Date.parse(departure) - Date.parse(arrival)) / 86_400_000);
}

export const nightsLabel = (n: number): string => `${n} ${n === 1 ? "noche" : "noches"}`;

/** «Casas libres del 16 nov al 16 dic»: las 30 noches que pide el mensual desde `from`. */
export function monthlyWindowLabel(from: string): string {
  return `Casas libres del ${shortDate(from)} al ${shortDate(addDays(from, MONTHLY_STAY_NIGHTS))}`;
}

/** Zonas cuyo nombre tiene una palabra que empieza con lo escrito (sin tildes ni mayúsculas): Caribe primero y por nombre. */
export function zoneSuggestions(zones: readonly ZoneWithListings[], query: string): ZoneWithListings[] {
  const q = norm(query);
  const match = zones.filter((z) => !q || norm(z.name).split(" ").some((w) => w.startsWith(q)));
  return caribeFirst(match.sort((a, b) => a.name.localeCompare(b.name, "es")));
}

/** «Talamanca, Limón». */
export const zonePlace = (z: Pick<ZoneWithListings, "canton" | "province">): string => `${z.canton}, ${z.province}`;
