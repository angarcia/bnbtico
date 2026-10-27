// Dinero: enteros en colones. Dólares solo al mostrar (referencia, no cobro), con el tipo de cambio vigente
// (`fx`: colones por dólar, domain/fx.ts; ticket 21).

const nbsp = "\u00a0";

/** ₡95 000 (espacio fino como separador de miles, igual que el prototipo). */
export function formatCRC(amount: number): string {
  const n = Math.round(amount);
  return "₡" + n.toLocaleString("es-CR").replace(/[.,\s\u00a0\u202f]/g, nbsp);
}

/** $186 — conversión orientativa redondeada al dólar. */
export function formatUSD(amountCRC: number, fx: number): string {
  return "$" + Math.round(amountCRC / fx).toLocaleString("en-US");
}

export function formatMoney(amountCRC: number, currency: "CRC" | "USD", fx: number): string {
  return currency === "USD" ? formatUSD(amountCRC, fx) : formatCRC(amountCRC);
}
