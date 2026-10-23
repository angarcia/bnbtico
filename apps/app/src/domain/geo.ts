// Ubicación aproximada: la ficha pública nunca muestra el punto exacto. Postgres lo desplaza en la vista listings_public
// (approx_point, entre 150 y 499 m, determinista por casa); el punto exacto no sale de la tabla.
export const APPROX_MIN_METERS = 150;
export const APPROX_MAX_METERS = 499;

export type LatLng = { lat: number; lng: number };

/** Haversine. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rectángulo generoso de Costa Rica (sin la Isla del Coco): basta para rechazar pines fuera del país. */
export function inCostaRica(lat: number, lng: number): boolean {
  return lat >= 8.0 && lat <= 11.3 && lng >= -86.0 && lng <= -82.5;
}

/** Centro del mapa del asistente por provincia, antes de marcar el pin. */
export const PROVINCE_CENTERS: Readonly<Record<string, LatLng>> = {
  Limón: { lat: 9.98, lng: -83.03 },
  Guanacaste: { lat: 10.63, lng: -85.44 },
  Puntarenas: { lat: 9.98, lng: -84.84 },
  Alajuela: { lat: 10.02, lng: -84.21 },
  "San José": { lat: 9.93, lng: -84.08 },
  Heredia: { lat: 10.0, lng: -84.12 },
  Cartago: { lat: 9.86, lng: -83.92 },
};

/** Punto con seis decimales (unos 10 cm): lo que se guarda del pin. */
export const roundPoint = (p: LatLng): LatLng => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) });
