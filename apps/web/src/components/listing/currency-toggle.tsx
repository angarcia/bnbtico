import { setCurrencyAction } from "@/actions/currency";
import type { Currency } from "@/lib/currency";
import { FX_CRC_PER_USD, formatCRC, formatUSD } from "@/lib/money";

/** «₡ · $» junto a la línea de resultados (Explorar). Solo visualización; vuelve a `next` tras cambiar. */
export function CurrencyToggle({ currency, next }: { currency: Currency; next: string }) {
  return (
    <form action={setCurrencyAction} className="row" style={{ gap: 4 }} aria-label="Moneda">
      <input type="hidden" name="next" value={next} />
      <button type="submit" name="currency" value="CRC" aria-pressed={currency === "CRC"} className="link small" style={{ fontWeight: currency === "CRC" ? 800 : 500, opacity: currency === "CRC" ? 1 : 0.6 }}>₡ Colones</button>
      <span className="small muted">·</span>
      <button type="submit" name="currency" value="USD" aria-pressed={currency === "USD"} className="link small" style={{ fontWeight: currency === "USD" ? 800 : 500, opacity: currency === "USD" ? 1 : 0.6 }}>$ Dólares</button>
    </form>
  );
}

/** «≈ $185» en la barra de la ficha: toca para ver el precio en la otra moneda. */
export function ApproxToggle({ currency, amountCrc, next }: { currency: Currency; amountCrc: number; next: string }) {
  const other = currency === "CRC" ? "USD" : "CRC";
  return (
    <form action={setCurrencyAction} style={{ display: "inline" }}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="currency" value={other} />
      <button type="submit" className="link xs" aria-label={other === "USD" ? "Ver en dólares" : "Ver en colones"} title={`≈ ₡${FX_CRC_PER_USD} por US$1`}>
        ≈ {other === "USD" ? formatUSD(amountCrc) : formatCRC(amountCrc)}
      </button>
    </form>
  );
}
