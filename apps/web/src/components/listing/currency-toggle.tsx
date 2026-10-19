import { setCurrencyAction } from "@/actions/currency";
import type { Currency } from "@/lib/currency";

/** Selector ₡ / $ (prototipo moneda.js). Solo visualización; vuelve a `next` tras cambiar. */
export function CurrencyToggle({ currency, next }: { currency: Currency; next: string }) {
  return (
    <form action={setCurrencyAction} className="seg" aria-label="Moneda">
      <input type="hidden" name="next" value={next} />
      <button type="submit" name="currency" value="CRC" aria-pressed={currency === "CRC"}>₡ Colones</button>
      <button type="submit" name="currency" value="USD" aria-pressed={currency === "USD"}>$ Dólares</button>
    </form>
  );
}
