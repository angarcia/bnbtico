// El precio orientativo de una estancia (ronda de Ana 2 nov, ticket 07). UNA regla, que search_listings repite en SQL
// (`search_stay_total`, migración total_orientativo_en_busqueda) y el fake usa tal cual; la prueba de contrato compara los dos.
// Con 30 noches o más y precio al mes: mes × noches / 30, redondeado al colón; si no, la suma de cada noche con su precio
// especial del calendario o, sin él, el de la noche. Siempre orientativo: nunca «total a pagar».
import { effectiveDay, type CalendarDays } from "./calendar";
import { addDays } from "./dates";

/** Desde cuántas noches una casa con precio al mes se estima por meses (y cuántas noches tiene ese mes). */
export const MONTHLY_ESTIMATE_NIGHTS = 30;

export interface StayInput {
  /** Las noches de la estancia, `YYYY-MM-DD`, de la llegada a la víspera de la salida (`stayNights`). */
  nights: readonly string[];
  /** Los días del calendario que difieren del habitual (precio especial u ocupados). */
  days: CalendarDays;
  /** Precio por noche; null = sin precio. */
  base: number | null;
  acceptsMonthly: boolean;
  /** Precio al mes; null (o 0) = a negociar. */
  monthlyCrc: number | null;
}

export interface StayEstimate {
  totalCrc: number;
  kind: "monthly" | "nightly";
}

/** Las noches de [llegada, salida): la salida no cuenta. Vacío si la salida no es posterior a la llegada. */
export function stayNights(arrival: string, departure: string): string[] {
  const out: string[] = [];
  for (let d = arrival; d < departure; d = addDays(d, 1)) out.push(d);
  return out;
}

/** El total orientativo de la estancia; null sin noches o si alguna noche no tiene precio. */
export function stayEstimate({ nights, days, base, acceptsMonthly, monthlyCrc }: StayInput): StayEstimate | null {
  if (nights.length === 0) return null;
  if (nights.length >= MONTHLY_ESTIMATE_NIGHTS && acceptsMonthly && monthlyCrc !== null && monthlyCrc > 0) {
    return { totalCrc: Math.round((monthlyCrc * nights.length) / MONTHLY_ESTIMATE_NIGHTS), kind: "monthly" };
  }
  let totalCrc = 0;
  for (const night of nights) {
    const price = effectiveDay(days, base, night).priceCrc;
    if (price === null) return null;
    totalCrc += price;
  }
  return { totalCrc, kind: "nightly" };
}
