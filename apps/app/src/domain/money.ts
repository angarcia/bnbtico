// Dinero: enteros en colones. Dólares solo al mostrar (referencia, no cobro), con el tipo de cambio vigente
// (`fx`: colones por dólar, domain/fx.ts; ticket 21).

const nbsp = "\u00a0";

/** ₡95 000 (espacio fino como separador de miles, igual que el prototipo). */
export function formatCRC(amount: number): string {
  const n = Math.round(amount);
  return "₡" + n.toLocaleString("es-CR").replace(/[.,\s\u00a0\u202f]/g, nbsp);
}

/** $186, $2 843 — conversión orientativa redondeada al dólar; miles con espacio, como los colones (la coma se lee como
 *  decimal en español y el punto en inglés; revisión UX 2026-10-29, N3). */
export function formatUSD(amountCRC: number, fx: number): string {
  return "$" + String(Math.round(amountCRC / fx)).replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);
}

export function formatMoney(amountCRC: number, currency: "CRC" | "USD", fx: number): string {
  return currency === "USD" ? formatUSD(amountCRC, fx) : formatCRC(amountCRC);
}
