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
