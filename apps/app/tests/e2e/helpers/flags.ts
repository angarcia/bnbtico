// Modo de Explorar del build que prueban los flujos (feature flags, historia #58): el mismo cálculo que vite.config.ts con
// las mismas variables FLAG_* del entorno. Las pruebas de un modo se saltan cuando el build no está en ese modo
// (decisión 2026-11-17: CI prueba la configuración que se despliega; la búsqueda por fechas recupera su build en #60).
import { parseFlags, searchModeOf, type Flags, type SearchMode } from "../../../src/domain/flags";
import { test } from "./test";

const parsed = parseFlags(process.env);
if (!parsed.ok) throw new Error(`${parsed.errors.join(", ")} no es válida: use «true», «false» o déjela vacía.`);

export const BUILD_FLAGS: Flags = parsed.flags;
export const BUILD_SEARCH_MODE: SearchMode = searchModeOf(parsed.flags);

/** Dentro de una prueba (o de un `describe`): la salta si el build no está en ese modo de Explorar. */
export function onlySearchMode(mode: SearchMode): void {
  test.skip(BUILD_SEARCH_MODE !== mode, `El build está en modo «${BUILD_SEARCH_MODE}»; esta prueba es del modo «${mode}» (feature flags).`);
}

/** Dentro de una prueba: la salta si el build no tiene las habitaciones encendidas (historia #62). */
export function onlyRooms(): void {
  test.skip(!BUILD_FLAGS.rooms, "El build tiene las habitaciones apagadas; esta prueba es de habitaciones (feature flags).");
}
