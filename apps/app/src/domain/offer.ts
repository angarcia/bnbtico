// Promoción de lanzamiento (CLAUDE.md): las primeras 50 casas aprobadas tienen 12 meses gratis, las siguientes 50 seis
// meses y las siguientes 100 tres meses; después, ₡2 900 al mes por casa, sin permanencia (decisión 2026-10-27).
export const MONTHLY_FEE_CRC = 2900;
export const LAUNCH_TIERS: readonly { size: number; months: number }[] = [
  { size: 50, months: 12 },
  { size: 50, months: 6 },
  { size: 100, months: 3 },
];

export interface LaunchOffer {
  /** Meses gratis del tramo en curso. */
  months: number;
  size: number;
  /** Plazas de este tramo ya asignadas. */
  taken: number;
  remaining: number;
}

/** Tramo en curso según cuántas plazas hay asignadas (fase 5: cada casa toma la suya en su primera aprobación y la
 *  conserva para siempre; hasta el ticket 06 las pantallas aún pasan las casas activas); null cuando la oferta se agotó.
 *  Las reglas de la suscripción viven en subscription.ts, que reexporta esto. */
export function launchOffer(taken: number): LaunchOffer | null {
  let left = Math.max(0, Math.floor(taken));
  for (const tier of LAUNCH_TIERS) {
    if (left < tier.size) return { months: tier.months, size: tier.size, taken: left, remaining: tier.size - left };
    left -= tier.size;
  }
  return null;
}
