// Promoción de lanzamiento (CLAUDE.md): las primeras 50 casas activas tienen 12 meses gratis, las siguientes 50 seis
// meses y las siguientes 100 tres meses; después, ₡9 900 al mes por casa, sin permanencia.
export const MONTHLY_FEE_CRC = 9900;
export const LAUNCH_TIERS: readonly { size: number; months: number }[] = [
  { size: 50, months: 12 },
  { size: 50, months: 6 },
  { size: 100, months: 3 },
];

export interface LaunchOffer {
  /** Meses gratis del tramo en curso. */
  months: number;
  size: number;
  /** Casas que ya ocupan plaza en este tramo. */
  taken: number;
  remaining: number;
}

/** Tramo en curso según cuántas casas hay activas; null cuando la oferta se agotó. */
export function launchOffer(activeCount: number): LaunchOffer | null {
  let left = Math.max(0, Math.floor(activeCount));
  for (const tier of LAUNCH_TIERS) {
    if (left < tier.size) return { months: tier.months, size: tier.size, taken: left, remaining: tier.size - left };
    left -= tier.size;
  }
  return null;
}
