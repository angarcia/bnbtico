// Feature flags por entorno (historia #58, decisiones del 2026-11-17 en docs/decisiones.md). Se configuran con
// variables de GitHub por entorno (FLAG_*_PRUEBAS y FLAG_*_PRODUCCION) y cambian al desplegar. El build las lee para el
// navegador y el worker (vite.config.ts: __FLAGS__), y el despliegue escribe en la base las que necesitan autoridad de
// servidor (scripts/deploy-target.mjs «flags», tabla feature_flags). Contrato completo: docs/feature-flags.md.
// La misma interpretación vive en scripts/deploy-target.mjs (JavaScript sin compilar); tests/unit/flags.test.ts
// comprueba que las dos dan lo mismo.

export const FLAG_NAMES = ["exploreDates", "exploreNights", "datePrices", "externalCalendars", "rooms"] as const;
export type FlagName = (typeof FLAG_NAMES)[number];
export type Flags = Readonly<Record<FlagName, boolean>>;

/** Valores iniciales (épica #57): sin variable, cada entorno usa estos. */
export const DEFAULT_FLAGS: Flags = {
  exploreDates: false, // fechas y disponibilidad en Explorar
  exploreNights: true, // número de noches en Explorar
  datePrices: false, // precios por fecha (tarifas especiales)
  externalCalendars: true, // calendarios externos (iCal: importar y exportar)
  rooms: false, // publicar y filtrar habitaciones
};

/** Variable de build; en GitHub lleva además el sufijo del entorno (_PRUEBAS o _PRODUCCION). */
export const FLAG_VARIABLES: Readonly<Record<FlagName, string>> = {
  exploreDates: "FLAG_EXPLORAR_FECHAS",
  exploreNights: "FLAG_EXPLORAR_NOCHES",
  datePrices: "FLAG_PRECIOS_POR_FECHA",
  externalCalendars: "FLAG_ICAL",
  rooms: "FLAG_HABITACIONES",
};

export type FlagsResult = { ok: true; flags: Flags } | { ok: false; errors: string[] };

/** Solo «true», «false» o vacío (= valor inicial). Cualquier otra cosa es un error que nombra la variable: mejor no
 *  desplegar que adivinar qué quería decir «1» o «si». */
export function parseFlags(env: Readonly<Record<string, string | undefined>>): FlagsResult {
  const flags: Record<FlagName, boolean> = { ...DEFAULT_FLAGS };
  const errors: string[] = [];
  for (const name of FLAG_NAMES) {
    const raw = (env[FLAG_VARIABLES[name]] ?? "").trim();
    if (raw === "true" || raw === "false") flags[name] = raw === "true";
    else if (raw !== "") errors.push(FLAG_VARIABLES[name]);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, flags };
}

export type SearchMode = "dates" | "nights" | "none";

/** Explorar: con las dos encendidas mandan las fechas; con las dos apagadas, búsqueda sin estancia (precio por noche). */
export function searchModeOf(flags: Pick<Flags, "exploreDates" | "exploreNights">): SearchMode {
  if (flags.exploreDates) return "dates";
  return flags.exploreNights ? "nights" : "none";
}
