// Números de WhatsApp de atención (Ayuda) en el build (revisión UX A12). Ayuda es el único canal de bnbtico: con la app
// abierta en producción (LAUNCHED "true") el build no sigue sin ellos; antes del lanzamiento solo avisa, para no frenar los
// despliegues de la portada.

export type SupportCheck = { level: "error" | "warning"; message: string } | null;

export function supportNumbersCheck({ launched, owners, guests }: { launched: boolean; owners?: string; guests?: string }): SupportCheck {
  const missing = [!owners?.trim() && "WA_OWNERS", !guests?.trim() && "WA_GUESTS"].filter(Boolean);
  if (!missing.length) return null;
  return launched
    ? { level: "error", message: `Falta ${missing.join(" y ")} con LAUNCHED "true": Ayuda saldría desactivada en producción.` }
    : { level: "warning", message: "WA_OWNERS / WA_GUESTS sin configurar: Ayuda sale desactivada." };
}

interface WranglerVars {
  vars?: { LAUNCHED?: string };
}

/** LAUNCHED del entorno de wrangler que se construye (`CLOUDFLARE_ENV`); los `vars` de un entorno no heredan los de arriba. */
export function launchedFor(config: WranglerVars & { env?: Record<string, WranglerVars> }, environment: string | undefined): boolean {
  const vars = environment ? config.env?.[environment]?.vars : config.vars;
  return vars?.LAUNCHED === "true";
}
