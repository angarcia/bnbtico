import type { CalendarDay } from "../domain/calendar";
import type { PublicListing } from "../domain/listing";

/** Lo que el worker deja en `<script type="application/json" id="ssr-data">` para que el navegador hidrate. `days`: las
 *  filas de `public_listing_days` (el calendario de la ficha se monta con ellas tras hidratar, sin otra petición). */
export type SsrData =
  | { page: "listing"; listing: PublicListing; days: CalendarDay[]; base: string }
  | { page: "missing" }
  | { page: "blocked" }
  | { page: "error" };

export const SSR_DATA_ID = "ssr-data";
