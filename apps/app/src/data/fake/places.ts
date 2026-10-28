// Fake en memoria de PlacesApi. Licencia: los polígonos están dibujados a mano (no derivan de OpenStreetMap; los de
// verdad viven solo en la base, ODbL) y apenas aproximan tres distritos del Caribe. Las zonas son filas copiadas de la
// migración `zonas` (mismos ids y coordenadas).
import type { PlacesApi } from "../../domain/api";
import { distanceMeters, type LatLng } from "../../domain/geo";
import { caribeFirst, type NearZone, type Place, type Zone } from "../../domain/zones";

/** Margen de la costa: un pin fuera de todo polígono cae en el distrito más cercano si está a 500 m o menos. */
const COAST_MARGIN_M = 500;

/**
 * Cahuita (70403): el borde del mar pasa por C = (9.641338, -82.69355), perpendicular al azimut 341.07° (el de las
 * pruebas de los límites), entre los dos primeros vértices, 400 m a cada lado de C; así el pin de la playa a 100 m
 * queda fuera y a 100 m, y el de 600 m a más de 500 m de todo borde. El resto rodea Cocles, Puerto Viejo y Cahuita.
 */
export const FAKE_DISTRICTS: readonly { code: string; province: string; canton: string; district: string; ring: readonly LatLng[] }[] = [
  {
    code: "70403",
    province: "Limón",
    canton: "Talamanca",
    district: "Cahuita",
    ring: [
      { lat: 9.642512, lng: -82.690102 },
      { lat: 9.640164, lng: -82.696998 },
      { lat: 9.654904, lng: -82.71633 },
      { lat: 9.758906, lng: -82.830227 },
      { lat: 9.740819, lng: -82.866674 },
      { lat: 9.596119, lng: -82.802892 },
      { lat: 9.614207, lng: -82.675326 },
    ],
  },
  {
    code: "70102",
    province: "Limón",
    canton: "Limón",
    district: "Valle La Estrella",
    ring: [
      { lat: 9.77, lng: -83.0 },
      { lat: 9.77, lng: -82.88 },
      { lat: 9.9, lng: -82.86 },
      { lat: 9.9, lng: -83.02 },
    ],
  },
  {
    code: "70101",
    province: "Limón",
    canton: "Limón",
    district: "Limón",
    ring: [
      { lat: 9.95, lng: -83.1 },
      { lat: 9.95, lng: -83.0 },
      { lat: 10.03, lng: -83.0 },
      { lat: 10.03, lng: -83.1 },
    ],
  },
];

/** Las zonas obligatorias de la migración `zonas` (nueve de Talamanca y Limón centro), todas activas. */
export const FAKE_ZONES: readonly Zone[] = [
  { id: "704-puerto-viejo", name: "Puerto Viejo", cantonCode: "704", lat: 9.656494, lng: -82.753565 },
  { id: "704-playa-negra", name: "Playa Negra", cantonCode: "704", lat: 9.664096, lng: -82.772693 },
  { id: "704-cocles", name: "Cocles", cantonCode: "704", lat: 9.643783, lng: -82.730561 },
  { id: "704-playa-chiquita", name: "Playa Chiquita", cantonCode: "704", lat: 9.637403, lng: -82.703669 },
  { id: "704-punta-uva", name: "Punta Uva", cantonCode: "704", lat: 9.640909, lng: -82.686332 },
  { id: "704-manzanillo", name: "Manzanillo", cantonCode: "704", lat: 9.631671, lng: -82.657207 },
  { id: "704-cahuita", name: "Cahuita", cantonCode: "704", lat: 9.738481, lng: -82.840763 },
  { id: "704-hone-creek", name: "Hone Creek", cantonCode: "704", lat: 9.655125, lng: -82.800143 },
  { id: "704-bribri", name: "Bribrí", cantonCode: "704", lat: 9.626305, lng: -82.852517 },
  { id: "701-limon-centro", name: "Limón centro", cantonCode: "701", lat: 9.993161, lng: -83.029761 },
];

function inRing(p: LatLng, ring: readonly LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}

/** Distancia en metros del punto al borde del anillo (equirectangular alrededor del punto: basta a esta escala). */
function distanceToRing(p: LatLng, ring: readonly LatLng[]): number {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110_574;
  const xy = (q: LatLng) => [(q.lng - p.lng) * kx, (q.lat - p.lat) * ky] as const;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = xy(ring[j]!);
    const [bx, by] = xy(ring[i]!);
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

const toPlace = (d: (typeof FAKE_DISTRICTS)[number]): Place => ({ province: d.province, canton: d.canton, district: d.district, districtCode: d.code });

/** El distrito que contiene el punto; si ninguno, el más cercano a 500 m o menos; si no, null. */
export function fakePlaceAt(lat: number, lng: number): Place | null {
  const p = { lat, lng };
  const within = FAKE_DISTRICTS.find((d) => inRing(p, d.ring));
  if (within) return toPlace(within);
  let nearest: { d: (typeof FAKE_DISTRICTS)[number]; m: number } | null = null;
  for (const d of FAKE_DISTRICTS) {
    const m = distanceToRing(p, d.ring);
    if (m <= COAST_MARGIN_M && (!nearest || m < nearest.m)) nearest = { d, m };
  }
  return nearest ? toPlace(nearest.d) : null;
}

/** Como zones_near: zonas a km o menos (entre 0 y 50; 5 por defecto), metros enteros, la más cercana primero. */
export function fakeZonesNear(lat: number, lng: number, km = 5): NearZone[] {
  const limit = Math.min(Math.max(km, 0), 50) * 1000;
  return FAKE_ZONES.map((z) => ({ id: z.id, name: z.name, distanceM: Math.round(distanceMeters({ lat, lng }, z)) }))
    .filter((z) => z.distanceM <= limit)
    .sort((a, b) => a.distanceM - b.distanceM || a.name.localeCompare(b.name));
}

export function createFakePlaces(): PlacesApi {
  return {
    async placeAt(lat, lng) {
      return fakePlaceAt(lat, lng);
    },
    async zonesNear(lat, lng, km) {
      return fakeZonesNear(lat, lng, km);
    },
    async listZones() {
      return caribeFirst(
        [...FAKE_ZONES].sort((a, b) => b.cantonCode.localeCompare(a.cantonCode) || a.name.localeCompare(b.name)),
      );
    },
  };
}
