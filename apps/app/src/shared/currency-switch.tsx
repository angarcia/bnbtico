import { setCurrency, useCurrency } from "./currency";

/**
 * Selector único de moneda: «₡ | $» en la barra superior de las pestañas. Cambia cómo se ven los precios de Explorar,
 * Favoritos, los calendarios y los filtros; la ficha no lo lleva y muestra las dos monedas (2026-10-29). Los propietarios
 * fijan y cobran en colones.
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
