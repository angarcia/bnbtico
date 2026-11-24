import { Segmented } from "./ui/choice";
import type { Currency } from "../domain/currency";
import { setCurrency, useCurrency } from "./currency";
import * as LISTING_PARTS_COPY from "./copy/listing-parts";

const OPTIONS = [
  { value: "CRC", label: "₡", name: LISTING_PARTS_COPY.colones },
  { value: "USD", label: "$", name: LISTING_PARTS_COPY.dollars },
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
      label={LISTING_PARTS_COPY.currency}
      currency
      float={placement === "float"}
      placement={placement === "float" ? undefined : placement}
    />
  );
}
