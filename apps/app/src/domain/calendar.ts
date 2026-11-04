// Calendario del propietario (fase 4): días ocupados y precios especiales, la selección de la pantalla como reductor
// puro, y las mismas reglas por día que la RPC save_listing_days (el fake y las escrituras optimistas usan applyChange).
// Fechas como `YYYY-MM-DD` sin zona horaria: «hoy» es siempre el de Costa Rica (costaRicaToday) y llega como argumento.
// Sin temporadas, sin precio de fin de semana y sin «Configurar tarifas» (fuera de v1).
import type { Currency } from "./currency";
import { parseColones, type ListingStatus } from "./listing";
import { addDays } from "./dates";
import { formatCRC, formatUSD } from "./money";

/** Una fila de listing_days: solo existe si el día difiere del habitual (ocupado y/o con precio especial). */
export interface CalendarDay {
  day: string;
  available: boolean;
  specialPriceCrc: number | null;
}

/** Cómo queda un día de verdad: `priceCrc` null en una casa solo mensual; `special` = la ★. */
export interface DayState {
  day: string;
  available: boolean;
  priceCrc: number | null;
  special: boolean;
}

/** Lo que guarda «Guardar cambios»: los días y lo que se eligió (lo que falta se conserva en cada día). */
export interface CalendarChange {
  days: string[];
  available?: boolean;
  priceCrc?: number;
}

export type CalendarDays = readonly CalendarDay[] | ReadonlyMap<string, CalendarDay>;

export const CALENDAR_WINDOW_DAYS = 365;
export const CALENDAR_MAX_DAYS = 366;
export const CALENDAR_MAX_PRICE_CRC = 100_000_000;

/** Mensajes de save_listing_days / set_listing_available, repetidos tal cual en la migración casa_pausada_textos y en el fake. */
export const CALENDAR_MESSAGES = {
  notFound: "No encontramos ese anuncio.",
  rejected: "Este anuncio fue rechazado; publique uno nuevo.",
  closed: "La casa está pausada. Vuelva a publicarla para cambiar el calendario.",
  range: "Elija días entre hoy y dentro de un año.",
  nothing: "No hay cambios que guardar.",
  price: "Escriba un precio por noche en colones, mayor que cero y sin decimales.",
  noNightlyPrice: "Ponga primero el precio por noche de la casa para cambiar el de un día.",
  reopenDate: "La fecha para volver a publicarla debe ser a partir de mañana y dentro de un año.",
  reopenWhileOpen: "La fecha para volver a publicarla solo se pone al pausar la casa.",
  notActive: "Solo puede cambiar la disponibilidad de una casa activa.",
} as const;

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_MS = 86_400_000;

/** Milisegundos UTC de una fecha válida (`2026-02-30` no lo es), o null. */
function toUtc(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const check = new Date(t);
  return check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? t : null;
}

/** `YYYY-MM-DD` de una fecha que existe. */
export const isIsoDate = (date: string): boolean => toUtc(date) !== null;

const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

export { addDays } from "./dates";

/** `YYYY-MM` `n` meses después (o antes). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return fromUtc(Date.UTC(y, m - 1 + n, 1)).slice(0, 7);
}

/** «Diciembre 2026». */
export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

/** Los días que se editan y se muestran: de hoy (Costa Rica) a hoy + 365, y sus meses primero y último. */
/** Días que deben quedar en el mes (hoy incluido) para abrir el calendario en él; con menos, abre en el siguiente. */
export const OPENING_MONTH_MIN_DAYS = 10;

/** Mes con que abre un calendario (ficha y propietario, revisión UX A4): a fin de mes, el siguiente, para no enseñar una
 *  rejilla casi entera de días pasados. «‹» sigue llevando al mes actual. */
export function openingMonth(today: string): string {
  const month = today.slice(0, 7);
  const next = addMonths(month, 1);
  const daysLeft = (Date.parse(`${next}-01T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return daysLeft >= OPENING_MONTH_MIN_DAYS ? month : next;
}

export function calendarWindow(today: string): { first: string; last: string; firstMonth: string; lastMonth: string } {
  const last = addDays(today, CALENDAR_WINDOW_DAYS);
  return { first: today, last, firstMonth: today.slice(0, 7), lastMonth: last.slice(0, 7) };
}

/** Los meses del calendario del propietario, del actual al último de la ventana (hoy + 365), uno debajo de otro. */
export function calendarMonths(today: string): string[] {
  const { firstMonth, lastMonth } = calendarWindow(today);
  const months: string[] = [];
  for (let m = firstMonth; m <= lastMonth; m = addMonths(m, 1)) months.push(m);
  return months;
}

const inWindow = (date: string, today: string) => toUtc(date) !== null && date >= today && date <= addDays(today, CALENDAR_WINDOW_DAYS);

function lookup(days: CalendarDays, date: string): CalendarDay | undefined {
  return "get" in days ? days.get(date) : days.find((d) => d.day === date);
}

/** Disponibilidad y precio de un día: sin fila, disponible al precio base. */
export function effectiveDay(days: CalendarDays, base: number | null, date: string): DayState {
  const row = lookup(days, date);
  const specialPrice = row?.specialPriceCrc ?? null;
  return {
    day: date,
    available: row?.available ?? true,
    priceCrc: specialPrice ?? base,
    special: specialPrice !== null && specialPrice !== base,
  };
}

export interface GridDay {
  day: string;
  date: number;
  /** Antes de hoy: atenuado y no editable. */
  past: boolean;
  /** Después de hoy + 365: fuera de la ventana, no editable. */
  beyond: boolean;
}

/** El mes en semanas de lunes a domingo; null = hueco antes del día 1 o después del último. */
export function monthGrid(month: string, today: string): { month: string; title: string; weeks: (GridDay | null)[][] } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = Date.UTC(y, m - 1, 1);
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const last = addDays(today, CALENDAR_WINDOW_DAYS);
  const cells: (GridDay | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= length; d++) {
    const day = fromUtc(first + (d - 1) * DAY_MS);
    cells.push({ day, date: d, past: day < today, beyond: day > last });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (GridDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, title: monthTitle(month), weeks };
}

/** El precio dentro de la casilla: completo, sin «₡» ni redondeo («38 900»; «38 mil» escondería un precio especial) y con
 *  espacio que no se parte; en dólares, el redondeo de la ficha («$76»). Revisión UX 2026-10-29, C4. */
export function dayPrice(crc: number, currency: Currency, fx: number): string {
  return currency === "USD" ? formatUSD(crc, fx) : formatCRC(crc).slice(1);
}

/** La casa vista por la regla de guardado; null = no es del usuario o no existe (también un invitado). */
export interface CalendarListing {
  status: ListingStatus;
  available: boolean;
  nightlyPriceCrc: number | null;
}

/** El primer motivo de rechazo, en el orden de la RPC, o null si se puede guardar. */
export function validateChange(change: CalendarChange, ctx: { today: string; listing: CalendarListing | null }): string | null {
  const { listing, today } = ctx;
  if (!listing) return CALENDAR_MESSAGES.notFound;
  if (listing.status === "rejected") return CALENDAR_MESSAGES.rejected;
  if (!listing.available) return CALENDAR_MESSAGES.closed;
  const days = new Set(change.days);
  if (days.size === 0 || days.size > CALENDAR_MAX_DAYS || [...days].some((d) => !inWindow(d, today))) return CALENDAR_MESSAGES.range;
  if (change.available === undefined && change.priceCrc === undefined) return CALENDAR_MESSAGES.nothing;
  if (change.priceCrc !== undefined) {
    const p = change.priceCrc;
    if (!Number.isInteger(p) || p < 1 || p > CALENDAR_MAX_PRICE_CRC) return CALENDAR_MESSAGES.price;
    if (listing.nightlyPriceCrc === null) return CALENDAR_MESSAGES.noNightlyPrice;
  }
  return null;
}

/** Los días guardados tras un cambio ya validado: ocupar o liberar conserva el precio; el precio base quita la ★; solo
 *  quedan filas que difieren del habitual. Devuelve una lista nueva ordenada por día. */
export function applyChange(days: readonly CalendarDay[], base: number | null, change: CalendarChange): CalendarDay[] {
  const next = new Map(days.map((d) => [d.day, d]));
  for (const day of new Set(change.days)) {
    const row = next.get(day) ?? { day, available: true, specialPriceCrc: null };
    const updated: CalendarDay = {
      day,
      available: change.available ?? row.available,
      specialPriceCrc: change.priceCrc === undefined ? row.specialPriceCrc : change.priceCrc === base ? null : change.priceCrc,
    };
    if (updated.available && updated.specialPriceCrc === null) next.delete(day);
    else next.set(day, updated);
  }
  return [...next.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Fecha opcional de reapertura: de mañana a hoy + 365. Vacía o null = sin fecha (válido). */
export function validateReopenDate(date: string | null, today: string): string | null {
  if (!date) return null;
  return toUtc(date) !== null && date > today && date <= addDays(today, CALENDAR_WINDOW_DAYS) ? null : CALENDAR_MESSAGES.reopenDate;
}

/** «Cerrar la casa hasta…» del Calendario (antes el interruptor «Anuncio visible») (set_listing_available): solo casas activas; abrir a mano cancela la fecha.
 *  No toca el estado de la casa: cerrada sigue publicada; abierta no republica una oculta. */
export function availabilityUpdate(
  listing: { status: ListingStatus },
  available: boolean,
  reopenAt: string | null,
  today: string,
): { available: boolean; reopenAt: string | null } | { error: string } {
  if (listing.status !== "active") return { error: CALENDAR_MESSAGES.notActive };
  if (available) return reopenAt ? { error: CALENDAR_MESSAGES.reopenWhileOpen } : { available: true, reopenAt: null };
  const error = validateReopenDate(reopenAt, today);
  return error ? { error } : { available: false, reopenAt: reopenAt || null };
}

/** Reapertura automática (reopen_due_listings): si la fecha llegó, abre a consultas y borra la fecha. Nunca toca el
 *  estado ni los días. Devuelve el mismo objeto si no toca abrir. */
export function reopenIfDue<T extends { available: boolean; reopenAt: string | null }>(listing: T, today: string): T {
  return !listing.available && listing.reopenAt !== null && listing.reopenAt <= today ? { ...listing, available: true, reopenAt: null } : listing;
}

/** El borrador del panel inferior. `available` y `price` se precargan con lo común a los días; los cambios solo cuentan
 *  si el propietario los eligió (`availabilityChosen`, `priceEdited`). */
export interface Selection {
  days: string[];
  available: boolean | null;
  availabilityChosen: boolean;
  /** Texto del campo «₡»; vacío con `mixedPrice` = «Varios precios». */
  price: string;
  priceEdited: boolean;
  mixedPrice: boolean;
}

export interface SelectionContext {
  days: CalendarDays;
  base: number | null;
  today: string;
}

export const emptySelection: Selection = Object.freeze({
  days: [],
  available: null,
  availabilityChosen: false,
  price: "",
  priceEdited: false,
  mixedPrice: false,
}) as Selection;

export function clearSelection(): Selection {
  return emptySelection;
}

function prefill(s: Selection, ctx: SelectionContext): Selection {
  if (s.days.length === 0) return emptySelection;
  const states = s.days.map((d) => effectiveDay(ctx.days, ctx.base, d));
  const next = { ...s };
  if (!s.availabilityChosen) next.available = states.every((d) => d.available === states[0]!.available) ? states[0]!.available : null;
  if (!s.priceEdited) {
    const price = states[0]!.priceCrc;
    next.mixedPrice = states.some((d) => d.priceCrc !== price);
    next.price = next.mixedPrice || price === null ? "" : String(price);
  }
  return next;
}

/** Tocar un día: lo añade o lo quita. Los días pasados o fuera de la ventana no se seleccionan. */
export function selectDay(s: Selection, date: string, ctx: SelectionContext): Selection {
  if (!inWindow(date, ctx.today)) return s;
  const days = s.days.includes(date) ? s.days.filter((d) => d !== date) : [...s.days, date].sort();
  return prefill({ ...s, days }, ctx);
}

export function setAvailability(s: Selection, available: boolean): Selection {
  return s.days.length === 0 ? s : { ...s, available, availabilityChosen: true };
}

export function setPrice(s: Selection, text: string): Selection {
  return s.days.length === 0 ? s : { ...s, price: text, priceEdited: true, mixedPrice: false };
}

/** El cambio a guardar, o null si no hay días o no se eligió nada (sin mutación). Un precio ilegible llega como NaN y
 *  lo rechaza validateChange. */
export function changeFromSelection(s: Selection): CalendarChange | null {
  if (s.days.length === 0 || (!s.availabilityChosen && !s.priceEdited)) return null;
  const change: CalendarChange = { days: [...s.days] };
  if (s.availabilityChosen && s.available !== null) change.available = s.available;
  if (s.priceEdited) change.priceCrc = parseColones(s.price) ?? Number.NaN;
  return change;
}

const shortDay = (date: string) => `${Number(date.slice(8))} ${SHORT_MONTHS[Number(date.slice(5, 7)) - 1]}`;

/** «1 noche · 20 dic», «3 noches · 20–22 dic», «4 noches · 30 dic – 2 ene», «3 noches · 20, 22 y 24 dic». */
export function selectionLabel(days: readonly string[]): string {
  const sorted = [...new Set(days)].sort();
  const n = sorted.length;
  if (n === 0) return "";
  const nights = `${n} noche${n === 1 ? "" : "s"}`;
  const first = sorted[0]!;
  const last = sorted[n - 1]!;
  const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);
  if (n === 1) return `${nights} · ${shortDay(first)}`;
  if (addDays(first, n - 1) === last) {
    return sameMonth(first, last) ? `${nights} · ${Number(first.slice(8))}–${shortDay(last)}` : `${nights} · ${shortDay(first)} – ${shortDay(last)}`;
  }
  const items = sorted.map((d, i) => (i === n - 1 || !sameMonth(d, sorted[i + 1]!) ? shortDay(d) : String(Number(d.slice(8)))));
  return `${nights} · ${items.slice(0, -1).join(", ")} y ${items[n - 1]}`;
}
