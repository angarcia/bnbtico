// El precio orientativo de una estancia (ticket 07 de la ronda del 2 nov): UNA regla, la de `stay_total_crc` en
// search_listings (SQL) y la del fake. Con 30 noches o más y precio al mes: mes × noches / 30; si no, la suma del
// precio de cada noche con los precios especiales del calendario. Siempre orientativo; nunca «total a pagar».
import { effectiveDay, type CalendarDays } from "./calendar";
import { addDays } from "./dates";

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
