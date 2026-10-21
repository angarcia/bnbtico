// Enfriamiento entre códigos para el mismo número (igual que el prototipo: 30 s). Cada envío real cuesta dinero.
export const RESEND_COOLDOWN_MS = 30_000;

/** Mensaje de error si aún no pasaron 30 s desde `sentAt`; null si ya se puede pedir otro código. */
export function cooldownError(sentAt: number | undefined, now: number): string | null {
  if (sentAt === undefined) return null;
  const remaining = sentAt + RESEND_COOLDOWN_MS - now;
  if (remaining <= 0) return null;
  return `Espere ${Math.ceil(remaining / 1000)} segundos antes de pedir otro código.`;
}

/** Segundos que faltan para poder pedir otro código (0 si ya se puede). Pensado para Server Components: se evalúa una vez por petición. */
export function resendWaitSeconds(sentAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now) / 1000));
}
