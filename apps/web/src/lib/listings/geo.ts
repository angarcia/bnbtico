// Ubicación aproximada: la ficha pública nunca muestra el punto exacto, sino uno desplazado de forma determinista
// (misma casa → mismo círculo) hasta 500 m. La dirección exacta la comparte el propietario por WhatsApp.
export const JITTER_METERS = 500;
const METERS_PER_DEGREE_LAT = 111_320;

/** Hash FNV-1a de 32 bits: estable entre ejecuciones y suficiente para repartir ángulo y distancia. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function approximate(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  const h = fnv1a(seed);
  const angle = ((h % 360) * Math.PI) / 180;
  const distance = 150 + ((h >>> 9) % 350); // 150–499 m: nunca el punto exacto, nunca más de 500 m
  const dLat = (distance * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const dLng = (distance * Math.sin(angle)) / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
  return { lat: Number((lat + dLat).toFixed(6)), lng: Number((lng + dLng).toFixed(6)) };
}

/** Haversine. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rectángulo generoso de Costa Rica (incluye la Isla del Coco no; basta para rechazar pines fuera del país). */
export function inCostaRica(lat: number, lng: number): boolean {
  return lat >= 8.0 && lat <= 11.3 && lng >= -86.0 && lng <= -82.5;
}
