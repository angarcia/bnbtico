/** «hoy», «ayer», «hace 3 días» o la fecha corta («12 oct.»). */
export function relativeDate(iso: string, now: number): string {
  const d = new Date(iso).getTime();
  const days = Math.floor((now - d) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** «15 de noviembre» a partir de `YYYY-MM-DD`, sin pasar por la zona horaria (igual en el worker y en el navegador). */
export function longDate(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} de ${month}` : null;
}

/** «23 de noviembre de 2026» (la etiqueta de un día del calendario de «¿Cuándo?»); null si la fecha no existe. */
export function longDateWithYear(date: string): string | null {
  const p = isoParts(date);
  return p ? `${p[2]} de ${MONTHS[p[1] - 1]} de ${p[0]}` : null;
}

/** Nota del botón deshabilitado de una casa que no recibe consultas y tiene fecha de reapertura. */
export function reopenLabel(date: string | null): string | null {
  const d = date ? longDate(date) : null;
  return d ? `Vuelve a estar disponible el ${d}` : null;
}

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «3 dic», «15 sep» (sin año); null si no es una fecha AAAA-MM-DD. */
export function shortDate(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const month = m ? SHORT_MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month}` : null;
}

// ---------- Fechas `YYYY-MM-DD` sin zona horaria (Explorar, la hoja de contacto, Actividad y el calendario) ----------
// Viven aquí y no en calendar.ts o inquiry.ts: esos son trozos diferidos y Explorar las necesita en el JS inicial.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
/** Costa Rica no tiene horario de verano: siempre UTC−6. */
const CR_OFFSET_MS = 6 * 3_600_000;

/** [año, mes, día] de una fecha que existe (`2026-02-30` no), o null. */
export function isoParts(date: string): [number, number, number] | null {
  const m = ISO_DATE.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  return check.getUTCMonth() === mo - 1 && check.getUTCDate() === d ? [y, mo, d] : null;
}

/** La fecha `n` días después (o antes) de `date`, que debe ser válida. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = isoParts(date)!;
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** La fecha de hoy en Costa Rica, `YYYY-MM-DD`. */
export function costaRicaToday(nowMs: number): string {
  return new Date(nowMs - CR_OFFSET_MS).toISOString().slice(0, 10);
}

/** «20–27 dic», «28 dic – 2 ene», «sin fechas». */
export function formatInquiryDates(arrival: string | null, departure: string | null): string {
  const a = arrival && departure && departure > arrival ? isoParts(arrival) : null;
  const d = a && departure ? isoParts(departure) : null;
  if (!a || !d) return "sin fechas";
  const [[, am, ad], [, dm, dd]] = [a, d];
  return am === dm ? `${ad}–${dd} ${SHORT_MONTHS[am - 1]}` : `${ad} ${SHORT_MONTHS[am - 1]} – ${dd} ${SHORT_MONTHS[dm - 1]}`;
}
