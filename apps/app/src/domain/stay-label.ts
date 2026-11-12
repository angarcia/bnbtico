// Cómo se dice la estancia: «4 noches» y el total orientativo «≈ ₡180 000 por 4 noches». Aparte de ./search (que los
// reexporta para Explorar) para que la ficha del servidor, su barra y la hoja de contacto los usen sin cargar las reglas de
// la búsqueda ni las zonas (ronda de Ana 2 nov, ticket 08). Puro: sin imports de framework.
import type { Currency } from "./currency";
import { formatMoney } from "./money";

export const nightsLabel = (n: number): string => `${n} ${n === 1 ? "noche" : "noches"}`;

/** El total orientativo de la estancia, «≈ ₡180 000 por 4 noches», en sus dos partes (la cifra va en negrita en la tarjeta,
 *  como la de «₡45 000 / noche»), en la moneda elegida (en dólares, redondeado como el resto). La cifra sale de la regla de
 *  domain/stay-price.ts (la búsqueda la calcula en SQL, `stay_total_crc`). Nunca «total a pagar». */
export function stayTotalLabel(totalCrc: number, nights: number, currency: Currency, fx: number): { amount: string; unit: string } {
  return { amount: `≈ ${formatMoney(totalCrc, currency, fx)}`, unit: `por ${nightsLabel(nights)}` };
}
