// Feature flags de este build (historia #58): las mismas en el navegador y en el worker (SSR de la ficha), porque las
// fija vite.config.ts al compilar. Sin build (Vitest), los valores iniciales. Solo deciden lo que se enseña: las reglas
// que no pueden depender del navegador las aplica la base con su propia copia (public.feature_flags()).
import { DEFAULT_FLAGS, searchModeOf, type Flags, type SearchMode } from "../domain/flags";

export const FLAGS: Flags = typeof __FLAGS__ === "undefined" ? DEFAULT_FLAGS : __FLAGS__;

/** Modo de Explorar de este build: fechas, número de noches o sin estancia. */
export const SEARCH_MODE: SearchMode = searchModeOf(FLAGS);
