// Explorar al estilo Airbnb: el resumen de la búsqueda, la línea de resultados, el rango de llegada y salida del
// calendario de «¿Cuándo?», el total orientativo de la tarjeta y las sugerencias de zona de «¿Dónde?». Puro y en el JS
// inicial: no importa calendar.ts ni inquiry.ts (trozos diferidos); las fechas salen de dates.ts.
import type { Currency } from "./currency";
import { formatInquiryDates } from "./dates";
import { ALL_PROVINCES, type Filters } from "./filters";
import { formatMoney } from "./money";
import { caribeFirst, norm, type ZoneWithListings } from "./zones";

type StayFilters = Pick<Filters, "arrival" | "departure">;

/** «23–27 nov»; null sin llegada y salida. */
export function stayLabel(f: StayFilters): string | null {
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
  const place = f.zone && zoneName ? ` en ${zoneName} y alrededores` : f.prov !== ALL_PROVINCES ? ` en ${f.prov}` : "";
  const stay = stayLabel(f);
  return { count: housesCount(n), rest: place + (stay ? ` · ${stay}` : "") };
}

export { tapRange, type RangeState } from "./range";

/** Noches entre dos fechas `YYYY-MM-DD`. */
export function nightsBetween(arrival: string, departure: string): number {
  return Math.round((Date.parse(departure) - Date.parse(arrival)) / 86_400_000);
}

export const nightsLabel = (n: number): string => `${n} ${n === 1 ? "noche" : "noches"}`;

/** El total orientativo de la tarjeta de Explorar, «≈ ₡180 000 por 4 noches», en sus dos partes (la cifra va en negrita, como
 *  la de «₡45 000 / noche»), en la moneda elegida (en dólares, redondeado como el resto). Lo calcula la búsqueda
 *  (`stay_total_crc`, regla de domain/stay-price.ts). Nunca «total a pagar». */
export function stayTotalLabel(totalCrc: number, nights: number, currency: Currency, fx: number): { amount: string; unit: string } {
  return { amount: `≈ ${formatMoney(totalCrc, currency, fx)}`, unit: `por ${nightsLabel(nights)}` };
}

/** Zonas cuyo nombre (o una de sus palabras) empieza con lo escrito, espacios incluidos («puerto v»), sin tildes ni mayúsculas: Caribe primero y por nombre. */
export function zoneSuggestions(zones: readonly ZoneWithListings[], query: string): ZoneWithListings[] {
  const q = norm(query);
  const match = zones.filter((z) => {
    const n = norm(z.name);
    return !q || n.startsWith(q) || n.includes(" " + q);
  });
  return caribeFirst(match.sort((a, b) => a.name.localeCompare(b.name, "es")));
}

/** «Talamanca, Limón». */
export const zonePlace = (z: Pick<ZoneWithListings, "canton" | "province">): string => `${z.canton}, ${z.province}`;
