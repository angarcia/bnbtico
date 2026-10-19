// Ubicación aproximada: la ficha pública nunca muestra el punto exacto, sino uno desplazado de forma determinista
// (misma casa → mismo círculo) hasta 500 m. La dirección exacta la comparte el propietario por WhatsApp.
export const JITTER_METERS = 500;

// El desplazamiento determinista lo calcula Postgres en la vista listings_public (función approx_point, migración
// fase2_permisos): así las coordenadas exactas nunca salen de la tabla, ni siquiera a la app.

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
