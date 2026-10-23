import { setCurrency, useCurrency } from "../shared/currency";

/** «₡ Colones · $ Dólares» de Explorar y Favoritos (solo cambia cómo se muestran los precios). */
export function CurrencySwitch() {
  const currency = useCurrency();
  return (
    <div className="row gap-4 currency-switch" role="group" aria-label="Moneda">
      <button type="button" className="link small" aria-pressed={currency === "CRC"} onClick={() => setCurrency("CRC")}>
        ₡ Colones
      </button>
      <span className="small muted">·</span>
      <button type="button" className="link small" aria-pressed={currency === "USD"} onClick={() => setCurrency("USD")}>
        $ Dólares
      </button>
    </div>
  );
}
