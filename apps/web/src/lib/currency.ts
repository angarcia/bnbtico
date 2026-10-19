// Moneda de visualización del cliente: colones por defecto, dólares solo como referencia (cookie, un año).
// Los propietarios fijan y cobran en colones; aquí nunca se convierte un precio «real».
import { cookies } from "next/headers";

export type Currency = "CRC" | "USD";
export const CURRENCY_COOKIE = "bnbtico_currency";

export function parseCurrency(value: string | undefined): Currency {
  return value === "USD" ? "USD" : "CRC";
}

export async function currentCurrency(): Promise<Currency> {
  const store = await cookies();
  return parseCurrency(store.get(CURRENCY_COOKIE)?.value);
}
