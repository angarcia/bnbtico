// Buscador del paso 2 (ubicación por punto): las zonas de la lista para el buscador del mapa y Photon (Komoot, datos de
// OpenStreetMap), en todo Costa Rica para el buscador (solo mueve el mapa) o a 5 km del pin para «Otra…». Aparte de
// zones.ts para que solo viaje con el asistente de publicar, no en el JS inicial.
import { bboxAround, distanceMeters, inCostaRica, type LatLng } from "./geo";
import { caribeFirst, norm, type Zone } from "./zones";

export const ZONE_QUERY_MIN = 3;
export const ZONE_DEBOUNCE_MS = 300;
export const ZONE_SUGGESTIONS = 5;
export const ZONE_ZOOM = 15;

export const PHOTON_ORIGIN = "https://photon.komoot.io";
/** Rectángulo de Costa Rica, el mismo de `inCostaRica` (oeste, sur, este, norte). */
const CR_BBOX = "-86,8,-82.5,11.3";

export interface PhotonPlace extends LatLng { name: string; detail: string }

/** Mismo nombre sin tildes, mayúsculas ni espacios de más («Limon centro» = «Limón Centro»). */
export const sameName = (a: string, b: string): boolean => norm(a) === norm(b);

/** Zonas del buscador: sin texto, todas con las del Caribe (código de cantón 7xx) primero; con texto, las que lo contienen
 *  (sin tildes ni mayúsculas), con el mismo orden. */
export function searchZones(zones: readonly Zone[], text: string, limit?: number): Zone[] {
  const q = norm(text);
  return caribeFirst(zones.filter((z) => !q || norm(z.name).includes(q))).slice(0, limit);
}

/** Petición a Photon con sesgo hacia `near`: en todo Costa Rica, o dentro del rectángulo de `withinM` alrededor del punto
 *  («Otra…»). null si el texto es demasiado corto para buscar. */
export function photonNearUrl(query: string, near: LatLng, withinM?: number): string | null {
  const q = query.trim();
  if (q.length < ZONE_QUERY_MIN) return null;
  const bbox = withinM === undefined ? CR_BBOX : bboxAround(near, withinM).join(",");
  const p = new URLSearchParams({ q, limit: "10", bbox, lat: String(near.lat), lon: String(near.lng) });
  p.append("osm_tag", "place");
  p.append("osm_tag", "natural:beach");
  return `${PHOTON_ORIGIN}/api/?${p}`;
}

/** Respuesta de Photon a lugares: solo Costa Rica, sin repetidos (mismo nombre y cantón), a ≤ `withinM` de `near` si se
 *  pide, del más cercano al más lejano; como mucho 5. */
export function parsePhotonNear(json: unknown, near: LatLng, withinM?: number): PhotonPlace[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const found: (PhotonPlace & { d: number })[] = [];
  for (const f of features) {
    const props = (f as { properties?: Record<string, unknown> })?.properties ?? {};
    const coords = (f as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates;
    const name = typeof props.name === "string" ? props.name.trim() : "";
    if (!name || props.countrycode !== "CR" || !Array.isArray(coords)) continue;
    const [lng, lat] = coords as unknown[];
    if (typeof lat !== "number" || typeof lng !== "number" || !inCostaRica(lat, lng)) continue;
    const d = distanceMeters(near, { lat, lng });
    if (withinM !== undefined && d > withinM) continue;
    const county = typeof props.county === "string" ? props.county : typeof props.city === "string" ? props.city : "";
    const state = typeof props.state === "string" ? props.state : "";
    const key = `${norm(name)}|${norm(county)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name, detail: [county, state].filter(Boolean).join(", "), lat, lng, d });
  }
  return found
    .sort((a, b) => a.d - b.d)
    .slice(0, ZONE_SUGGESTIONS)
    .map(({ d: _d, ...z }) => z);
}
