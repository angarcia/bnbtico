import { setCurrency, useCurrency } from "./currency";
import { useHydrated } from "./hydration";

/**
 * Selector único de moneda: «₡ | $» en la barra superior de las pestañas y en la ficha. Cambia cómo se ven todos los
 * precios de la app (tarjetas, ficha, Favoritos, calendario y filtros); los propietarios fijan y cobran en colones.
 */
export function CurrencySwitch({ className }: { className?: string }) {
  const currency = useCurrency();
  return (
    <div className={`currency-switch${className ? ` ${className}` : ""}`} role="group" aria-label="Moneda de los precios">
      <button type="button" aria-pressed={currency === "CRC"} aria-label="Colones" onClick={() => setCurrency("CRC")}>
        ₡
      </button>
      <button type="button" aria-pressed={currency === "USD"} aria-label="Dólares" onClick={() => setCurrency("USD")}>
        $
      </button>
    </div>
  );
}

/** En el servidor y al hidratar, una caja del mismo tamaño; después, el selector (la moneda elegida vive en el navegador). */
export function CurrencySwitchSlot({ className }: { className?: string }) {
  const hydrated = useHydrated();
  if (!hydrated) return <span className={`currency-switch currency-switch-box${className ? ` ${className}` : ""}`} aria-hidden="true" />;
  return <CurrencySwitch className={className} />;
}
