/** «hoy», «ayer», «hace 3 días» o la fecha corta («12 oct.»). */
export function relativeDate(iso: string, now: number): string {
  const d = new Date(iso).getTime();
  const days = Math.floor((now - d) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}
