// Zonas del paso 2 del asistente (ticket 22): sugerencias de Photon (Komoot, datos de OpenStreetMap) limitadas a Costa
// Rica, y las zonas frecuentes del Caribe sur con su centro fijo. El centro de la zona elegida solo sirve para abrir el
// mapa del paso 3 con zoom; lo que se guarda en la casa es el nombre (y luego el pin que marque el propietario).
import { inCostaRica, PROVINCE_CENTERS, type LatLng } from "./geo";

export interface ZoneOption extends LatLng {
  /** Lo que se escribe en el campo y se guarda en `listings.zone`. */
  name: string;
  /** Contexto para distinguir homónimos («Talamanca, Limón»). */
  detail: string;
}

/** Zonas frecuentes del Caribe sur, para tocar sin escribir. Coordenadas del centro del pueblo o la playa (OpenStreetMap). */
export const FREQUENT_ZONES: readonly ZoneOption[] = [
  { name: "Puerto Viejo", detail: "Talamanca, Limón", lat: 9.656, lng: -82.754 },
  { name: "Playa Negra", detail: "Talamanca, Limón", lat: 9.658, lng: -82.772 },
  { name: "Cocles", detail: "Talamanca, Limón", lat: 9.6438, lng: -82.7306 },
  { name: "Playa Chiquita", detail: "Talamanca, Limón", lat: 9.6374, lng: -82.7037 },
  { name: "Punta Uva", detail: "Talamanca, Limón", lat: 9.6409, lng: -82.6863 },
  { name: "Manzanillo", detail: "Talamanca, Limón", lat: 9.6317, lng: -82.6572 },
  { name: "Cahuita", detail: "Talamanca, Limón", lat: 9.7385, lng: -82.8408 },
  { name: "Limón centro", detail: "Limón, Limón", lat: 9.9932, lng: -83.0298 },
];

export const ZONE_QUERY_MIN = 3;
export const ZONE_DEBOUNCE_MS = 300;
export const ZONE_SUGGESTIONS = 5;
export const ZONE_ZOOM = 15;

export const PHOTON_ORIGIN = "https://photon.komoot.io";
/** Rectángulo de Costa Rica, el mismo de `inCostaRica` (oeste, sur, este, norte). */
const CR_BBOX = "-86,8,-82.5,11.3";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Petición a Photon: solo lugares (pueblo, barrio, localidad…) y playas dentro de Costa Rica, con sesgo hacia el centro
 *  de la provincia elegida. null si el texto es demasiado corto para buscar. */
export function photonUrl(query: string, province: string): string | null {
  const q = query.trim();
  if (q.length < ZONE_QUERY_MIN) return null;
  const center = PROVINCE_CENTERS[province];
  const p = new URLSearchParams({ q, limit: "10", bbox: CR_BBOX });
  if (center) {
    p.set("lat", String(center.lat));
    p.set("lon", String(center.lng));
  }
  p.append("osm_tag", "place");
  p.append("osm_tag", "natural:beach");
  return `${PHOTON_ORIGIN}/api/?${p}`;
}

/**
 * Respuesta de Photon (GeoJSON) a opciones: solo Costa Rica y dentro del país, sin repetidos (mismo nombre y cantón),
 * primero las del cantón elegido, luego las de la provincia y luego las demás (en el orden de Photon); como mucho 5.
 */
export function parsePhoton(json: unknown, prefer: { province: string; canton: string }): ZoneOption[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const seen = new Set<string>();
  const found: (ZoneOption & { rank: number })[] = [];
  for (const f of features) {
    const props = (f as { properties?: Record<string, unknown> })?.properties ?? {};
    const coords = (f as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates;
    const name = typeof props.name === "string" ? props.name.trim() : "";
    if (!name || props.countrycode !== "CR" || !Array.isArray(coords)) continue;
    const [lng, lat] = coords as unknown[];
    if (typeof lat !== "number" || typeof lng !== "number" || !inCostaRica(lat, lng)) continue;
    const county = typeof props.county === "string" ? props.county : typeof props.city === "string" ? props.city : "";
    const state = typeof props.state === "string" ? props.state : "";
    const key = `${norm(name)}|${norm(county)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const rank = prefer.canton && norm(county) === norm(prefer.canton) ? 0 : norm(state) === norm(prefer.province) ? 1 : 2;
    found.push({ name, detail: [county, state].filter(Boolean).join(", "), lat, lng, rank });
  }
  return found
    .map((z, i) => ({ z, i }))
    .sort((a, b) => a.z.rank - b.z.rank || a.i - b.i)
    .slice(0, ZONE_SUGGESTIONS)
    .map(({ z: { rank: _rank, ...z } }) => z);
}

/** La zona frecuente con ese nombre (sin tildes ni mayúsculas), si la hay. */
export function frequentZone(name: string): ZoneOption | null {
  const n = norm(name);
  return n ? (FREQUENT_ZONES.find((z) => norm(z.name) === n) ?? null) : null;
}

/** Centro con que abre el mapa del paso 3: el de la zona elegida en el paso 2 si sigue siendo la misma, si no el de una zona
 *  frecuente con ese nombre; null («Otra» o sin zona) → la provincia, como antes. */
export function zoneCenter(zone: string, chosen: { name: string; lat: number; lng: number } | null): LatLng | null {
  if (chosen && norm(chosen.name) === norm(zone) && inCostaRica(chosen.lat, chosen.lng)) return { lat: chosen.lat, lng: chosen.lng };
  const f = frequentZone(zone);
  return f ? { lat: f.lat, lng: f.lng } : null;
}
