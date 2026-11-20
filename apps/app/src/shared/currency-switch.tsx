import { Segmented } from "./choice";
import type { Currency } from "../domain/currency";
import { setCurrency, useCurrency } from "./currency";

const OPTIONS = [
  { value: "CRC", label: "₡", name: "Colones" },
  { value: "USD", label: "$", name: "Dólares" },
] as const satisfies readonly { value: Currency; label: string; name: string }[];

/**
 * Selector único de moneda: «₡ | $» en la barra superior de las pestañas. Cambia cómo se ven los precios de Explorar,
 * Favoritos, los calendarios y los filtros; la ficha no lo lleva y muestra las dos monedas (2026-10-29). Los propietarios
 * fijan y cobran en colones. Es un `Segmented` (historia 07, paso 4) con la clase `currency-switch` para su sitio.
 */
export function CurrencySwitch({ placement }: { placement?: "float" | "calendar-local-currency" | "desktop-currency" }) {
  return (
    <Segmented
      options={OPTIONS}
      value={useCurrency()}
      onChange={setCurrency}
      label="Moneda de los precios"
      currency
      float={placement === "float"}
      placement={placement === "float" ? undefined : placement}
    />
  );
}
