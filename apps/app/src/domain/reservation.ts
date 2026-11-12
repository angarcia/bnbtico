// «Marcar una reserva» del Calendario (ticket 04 de la ronda del 2 nov): las noches de una reserva y el aviso al marcarlas.
// Módulo aparte de calendar.ts para que vaya en el trozo de la hoja (mark-sheet-*), no en el del Calendario.
import { selectionLabel } from "./calendar";
import { addDays } from "./dates";

/** Las noches de una reserva, de la llegada a la víspera de la salida (la salida no se ocupa; misma regla que Explorar).
 *  Sin llegada, sin salida o con la salida igual o anterior a la llegada, ninguna. Se guardan como «ocupado» sin precio
 *  (save_listing_days): los precios especiales se conservan. */
export function reservationDays(arrival: string | null, departure: string | null): string[] {
  if (!arrival || !departure || departure <= arrival) return [];
  const days: string[] = [];
  for (let d = arrival; d < departure; d = addDays(d, 1)) days.push(d);
  return days;
}

/** «4 noches marcadas como ocupadas · 7–10 nov»: el aviso tras marcar una reserva (las fechas, como el panel de abajo).
 *  De «ocupadas» a la fecha, sin cortes de línea (espacios duros y, tras «7–», un U+2060): en el teléfono la fecha no
 *  se queda sola ni partida en otra línea. */
export function reservationLabel(days: readonly string[]): string {
  const n = new Set(days).size;
  const where = selectionLabel(days).split(" · ")[1] ?? "";
  const tail = `${n === 1 ? "ocupada" : "ocupadas"} · ${where}`.replace(/ /g, "\u00a0").replace(/–(?=\d)/g, "–\u2060");
  return `${n} ${n === 1 ? "noche marcada" : "noches marcadas"} como ${tail}`;
}
