import type { CalendarDay } from "../domain/calendar";
import type { FxRate } from "../domain/fx";
import type { PublicListing } from "../domain/listing";

/** Lo que el worker deja en `<script type="application/json" id="ssr-data">` para que el navegador hidrate. `days`: las
 *  filas de `public_listing_days` (el calendario de la ficha se monta con ellas tras hidratar, sin otra petición); null si no se pudieron leer: la
 *  ficha sale sin «Disponibilidad». `fx`: el tipo de cambio con que se pintó (los «≈» de la ficha); hidratar usa el mismo. */
export type SsrData =
  | { page: "listing"; listing: PublicListing; days: CalendarDay[] | null; fx: FxRate; base: string }
  | { page: "missing" }
  | { page: "blocked" }
  | { page: "error" };

export const SSR_DATA_ID = "ssr-data";
