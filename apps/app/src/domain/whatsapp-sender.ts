// Envío de WhatsApp desde el worker (avisos de fin de oferta, fase 5; los enlaces wa.me están en whatsapp.ts). Solo la
// interfaz y reglas puras: las implementaciones (Twilio con fetch y el falso) viven en src/server/reminders.ts.

/**
 * `ok: false, definite: true`: la pasarela lo rechazó antes de aceptarlo (se puede reintentar sin riesgo de duplicar).
 * `definite: false`: no sabemos si salió (error de red o sin respuesta a tiempo): nunca se reintenta solo.
 */
export type WhatsAppSendResult = { ok: true; ref: string } | { ok: false; definite: boolean; error: string };

export interface WhatsAppSender {
  /** `to` en E.164 (+506…). */
  send(to: string, body: string): Promise<WhatsAppSendResult>;
}

/** WHATSAPP_ALLOWLIST: números E.164 separados por comas, punto y coma o saltos de línea (los espacios dentro de un número
 *  se ignoran). null si no hay lista (sin filtro). */
export function parseAllowlist(raw: string | undefined): ReadonlySet<string> | null {
  if (raw === undefined || raw.trim() === "") return null;
  return new Set(
    raw
      .split(/[,;\n]+/)
      .map((n) => n.replace(/[^\d+]/g, ""))
      .filter((n) => /^\+\d{8,15}$/.test(n)),
  );
}

/** Horas de Costa Rica (UTC−6 todo el año, sin horario de verano). */
export function costaRicaHour(nowMs: number): number {
  return (new Date(nowMs).getUTCHours() + 18) % 24;
}

/** Los avisos solo salen de 08:00 a 17:59 de Costa Rica (14–23 UTC): nadie recibe un WhatsApp a las 3 de la mañana. */
export function inSendingHours(nowMs: number): boolean {
  const h = costaRicaHour(nowMs);
  return h >= 8 && h <= 17;
}
