// El precio orientativo de una estancia (ticket 07 de la ronda del 2 nov): UNA regla, la de `stay_total_crc` en
// search_listings (SQL) y la del fake. Con 30 noches o más y precio al mes: mes × noches / 30; si no, la suma del
// precio de cada noche con los precios especiales del calendario. Siempre orientativo; nunca «total a pagar».
import { effectiveDay, type CalendarDays } from "./calendar";
import type { Currency } from "./currency";
import { addDays, formatInquiryDates } from "./dates";
import type { PublicListing } from "./listing";
import { stayTotalLabel } from "./search";

/** Desde cuántas noches una casa con precio al mes se estima por mes. */
export const MONTHLY_ESTIMATE_NIGHTS = 30;

export interface StayEstimate {
  totalCrc: number;
  kind: "monthly" | "nightly";
}

export interface StayInput {
  /** Las noches de la estancia, de la llegada a la salida (la salida no cuenta): `YYYY-MM-DD`. */
  nights: readonly string[];
  /** Días del calendario que difieren del habitual (ocupados o con precio especial). */
  days: CalendarDays;
  /** Precio base por noche; null = sin precio. */
  base: number | null;
  acceptsMonthly: boolean;
  monthlyCrc: number | null;
}

/** Las noches de [arrival, departure): `arrival`, …, `departure` - 1. Vacío si la salida no es posterior. */
export function stayNights(arrival: string, departure: string): string[] {
  const out: string[] = [];
  for (let d = arrival; d < departure; d = addDays(d, 1)) out.push(d);
  return out;
}

/** El total orientativo de la estancia, o null si alguna noche no tiene precio (o no hay noches). */
export function stayEstimate({ nights, days, base, acceptsMonthly, monthlyCrc }: StayInput): StayEstimate | null {
  if (nights.length === 0) return null;
  if (nights.length >= MONTHLY_ESTIMATE_NIGHTS && acceptsMonthly && monthlyCrc !== null && monthlyCrc > 0) {
    return { totalCrc: Math.round((monthlyCrc * nights.length) / MONTHLY_ESTIMATE_NIGHTS), kind: "monthly" };
  }
  let total = 0;
  for (const night of nights) {
    const price = effectiveDay(days, base, night).priceCrc;
    if (price === null) return null;
    total += price;
  }
  return { totalCrc: total, kind: "nightly" };
}

type StayHouse = Pick<PublicListing, "acceptsNightly" | "nightlyPriceCrc" | "acceptsMonthly" | "monthlyPriceCrc">;

/** ¿Alguna noche de esas fechas está ocupada (o cerrada)? Fechas que vienen de Explorar o de un enlace viejo pueden traerlas:
 *  entonces no hay banda ni total, solo el aviso `RANGE_BUSY_MESSAGE`. La salida puede caer en un ocupado. */
export function hasBusyNight(l: StayHouse, days: CalendarDays, dates: { arrival: string; departure: string } | null): boolean {
  if (!dates) return false;
  const base = l.acceptsNightly ? l.nightlyPriceCrc : null;
  return stayNights(dates.arrival, dates.departure).some((n) => !effectiveDay(days, base, n).available);
}

export interface ListingStay extends StayEstimate {
  nights: number;
}

/** El total orientativo de una casa para esas fechas con los días ya cargados (los mismos de la ficha: ocupados y precios
 *  especiales), o null sin fechas o sin precio en alguna noche, o con una noche ocupada. La usan el calendario de la ficha, su barra de precio y la
 *  hoja de contacto: una sola cifra. */
export function listingStay(
  l: StayHouse,
  days: CalendarDays,
  dates: { arrival: string; departure: string } | null,
): ListingStay | null {
  if (!dates || hasBusyNight(l, days, dates)) return null;
  const nights = stayNights(dates.arrival, dates.departure);
  const estimate = stayEstimate({ nights, days, base: l.acceptsNightly ? l.nightlyPriceCrc : null, acceptsMonthly: l.acceptsMonthly, monthlyCrc: l.monthlyPriceCrc });
  return estimate && { ...estimate, nights: nights.length };
}

/** «≈ ₡180 000 por 4 noches · 20–24 nov»: la línea bajo el calendario de la ficha y sobre el mensaje de la hoja. */
export function stayLine(stay: ListingStay, dates: { arrival: string; departure: string }, currency: Currency, fx: number): string {
  return `${stayTotalLabel(stay.totalCrc, stay.nights, currency, fx)} · ${formatInquiryDates(dates.arrival, dates.departure)}`;
}
