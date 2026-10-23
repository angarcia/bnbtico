// Dinero: enteros en colones. Dólares solo al mostrar (referencia, no cobro).
export const FX_CRC_PER_USD = 510; // referencia de la demo; en producción vendrá de configuración

const nbsp = "\u00a0";

/** ₡95 000 (espacio fino como separador de miles, igual que el prototipo). */
export function formatCRC(amount: number): string {
  const n = Math.round(amount);
  return "₡" + n.toLocaleString("es-CR").replace(/[.,\s\u00a0\u202f]/g, nbsp);
}

/** $186 — conversión orientativa redondeada al dólar. */
export function formatUSD(amountCRC: number, fx: number = FX_CRC_PER_USD): string {
  return "$" + Math.round(amountCRC / fx).toLocaleString("en-US");
}

export function formatMoney(amountCRC: number, currency: "CRC" | "USD"): string {
  return currency === "USD" ? formatUSD(amountCRC) : formatCRC(amountCRC);
}
