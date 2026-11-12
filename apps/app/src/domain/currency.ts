// Moneda de visualización del cliente: colones por defecto, dólares solo como referencia (estado local del navegador).
// Los propietarios fijan y cobran en colones; aquí nunca se convierte un precio «real».
export type Currency = "CRC" | "USD";
export const CURRENCY_STORAGE_KEY = "3bstays_currency";

export function parseCurrency(value: string | null | undefined): Currency {
  return value === "USD" ? "USD" : "CRC";
}
