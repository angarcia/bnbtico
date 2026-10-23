import type { PublicListing } from "../domain/listing";

/** Lo que el worker deja en `<script type="application/json" id="ssr-data">` para que el navegador hidrate. */
export type SsrData = { page: "listing"; listing: PublicListing; base: string } | { page: "missing" } | { page: "blocked" } | { page: "error" };

export const SSR_DATA_ID = "ssr-data";
