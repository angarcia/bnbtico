import { setCurrency, useCurrency } from "../shared/currency";

/**
 * Selector único de moneda (ticket 15): «₡ | $» en la cabecera de Explorar y en Cuenta. Cambia cómo se ven todos los
 * precios de la app (tarjetas, ficha, Favoritos, calendario y filtros); los propietarios fijan y cobran en colones.
 */
export function CurrencySwitch() {
  const currency = useCurrency();
  return (
    <div className="currency-switch" role="group" aria-label="Moneda de los precios">
      <button type="button" aria-pressed={currency === "CRC"} aria-label="Colones" onClick={() => setCurrency("CRC")}>
        ₡
      </button>
      <button type="button" aria-pressed={currency === "USD"} aria-label="Dólares" onClick={() => setCurrency("USD")}>
        $
      </button>
    </div>
  );
}
