// Deslizador de precio de Filtros (ticket 11 de la ronda de Ana del 2 nov): topes, cubetas del histograma y paso entre el
// deslizador y los límites de la URL (colones enteros; 0 = sin límite). Sin imports de framework.

export const HISTOGRAM_BUCKETS = 24;
const MIN_STEP = 1_000;

export interface PriceBounds {
  lo: number; // tope de abajo = «sin mínimo»
  hi: number; // tope de arriba = «sin máximo» (se muestra con «+»)
  step: number;
}

/** El paso «redondo» (1, 2 o 5 por una potencia de 10, desde ₡1 000) que deja unos 40 pasos en el rango. */
function niceStep(span: number): number {
  const target = Math.max(span / 40, MIN_STEP);
  const pow = 10 ** Math.floor(Math.log10(target));
  for (const m of [1, 2, 5, 10]) if (m * pow >= target) return m * pow;
  return 10 * pow;
}

/** Topes del deslizador: del precio más bajo al más alto de la búsqueda, redondeados hacia fuera al paso. */
export function priceBounds(prices: readonly (number | null)[]): PriceBounds | null {
  const valid = prices.filter((p): p is number => p !== null && p > 0);
  if (!valid.length) return null;
  const lowest = Math.min(...valid);
  const highest = Math.max(...valid);
  const step = niceStep(highest - lowest);
  const lo = Math.floor(lowest / step) * step;
  const hi = Math.max(Math.ceil(highest / step) * step, lo + step);
  return { lo, hi, step };
}

/** Cuántas casas hay en cada cubeta de igual ancho entre los topes (el tope de arriba cae en la última). */
export function priceHistogram(prices: readonly (number | null)[], bounds: PriceBounds, buckets = HISTOGRAM_BUCKETS): number[] {
  const counts = Array.from({ length: buckets }, () => 0);
  const width = bounds.hi - bounds.lo;
  for (const p of prices) {
    if (p === null || p < bounds.lo || p > bounds.hi) continue;
    counts[Math.min(buckets - 1, Math.floor(((p - bounds.lo) / width) * buckets))]!++;
  }
  return counts;
}

/** La cubeta `i` está «dentro» si alguna parte suya cae en el rango elegido [from, to]. */
export function bucketInRange(i: number, bounds: PriceBounds, buckets: number, from: number, to: number): boolean {
  const width = (bounds.hi - bounds.lo) / buckets;
  const start = bounds.lo + i * width;
  return start <= to && start + width > from;
}

/** Posiciones del deslizador → límites de la URL: el tope de abajo es «sin mínimo» y el de arriba «sin máximo». */
export function sliderToLimits(a: number, b: number, bounds: PriceBounds): { min: number; max: number } {
  return { min: a <= bounds.lo ? 0 : a, max: b >= bounds.hi ? 0 : b };
}

/** Límites de la URL → posiciones del deslizador, dentro de los topes y sin cruzarse. */
export function limitsToSlider(min: number, max: number, bounds: PriceBounds): [number, number] {
  const clamp = (n: number) => Math.min(bounds.hi, Math.max(bounds.lo, n));
  const a = min ? clamp(min) : bounds.lo;
  const b = max ? clamp(max) : bounds.hi;
  return [Math.min(a, b), b];
}
