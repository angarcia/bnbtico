// Zonas del paso 2 «¿Dónde está su casa?» (ubicación por punto, .scratch/ubicacion-por-punto): el pin manda y la zona se
// elige entre lo cercano (la tabla `zones` a 5 km o menos y el distrito del pin) o con «Otra…». Lo de buscar (Photon y la
// lista de zonas) vive en place-search.ts: este módulo lo importa domain/listing.ts y va en el JS inicial.
import { distanceMeters, type LatLng } from "./geo";

/** Nombre sin tildes, mayúsculas ni espacios de más, para comparar («Limon centro» = «Limón Centro»). */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const ZONE_RADIUS_M = 5000;
export const OTHER_ZONE_MAX = 60;
export const PLACE_DEBOUNCE_MS = 300;

export type ZoneSource = "list" | "district" | "other";
/** Una fila de `place_at`. */
export interface Place { province: string; canton: string; district: string; districtCode: string }
/** Una fila de `zones_near`. */
export interface NearZone { id: string; name: string; distanceM: number }
/** Una zona de la tabla `zones` (para el buscador). */
export interface Zone { id: string; name: string; cantonCode: string; lat: number; lng: number }
/** Caribe (código de cantón 7xx, Limón) primero; el resto del orden se respeta. */
export const caribeFirst = (zones: readonly Zone[]): Zone[] =>
  [...zones].sort((a, b) => Number(!a.cantonCode.startsWith("7")) - Number(!b.cantonCode.startsWith("7")));
/** La zona elegida. `anchor`: donde estaba el pin al elegirla con «Otra…» (null en las demás). */
export interface ZoneChoice { name: string; source: ZoneSource; zoneId: string | null; anchor: LatLng | null }
export interface ZoneSelectOption { key: string; name: string; source: "list" | "district"; zoneId: string | null; distanceM: number | null }

/** Zonas a ≤ 5 km (la más cercana primero) y el distrito, sin repetir nombre (manda la de la lista). */
export function zoneOptions(near: readonly NearZone[], place: Place | null): ZoneSelectOption[] {
  const options: ZoneSelectOption[] = [...near]
    .filter((z) => z.distanceM <= ZONE_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM)
    .map((z) => ({ key: `list:${z.id}`, name: z.name, source: "list", zoneId: z.id, distanceM: z.distanceM }));
  if (place && place.district.trim() && !options.some((o) => norm(o.name) === norm(place.district))) {
    options.push({ key: `district:${place.districtCode}`, name: place.district, source: "district", zoneId: null, distanceM: null });
  }
  return options;
}

const choiceOf = (o: ZoneSelectOption): ZoneChoice => ({ name: o.name, source: o.source, zoneId: o.zoneId, anchor: null });

/** La zona que queda tras mover el pin; null solo si no hay ninguna opción todavía. Sin opciones (buscando o sin red)
 *  se queda lo elegido. */
export function reconcileZone(current: ZoneChoice | null, pin: LatLng, options: readonly ZoneSelectOption[], place: Place | null): ZoneChoice | null {
  const first = options[0];
  if (!first) return current;
  if (current) {
    // Un distrito elegido cuya opción quitó una zona de la lista con el mismo nombre pasa a esa zona: si no, la lista se
    // quedaría sin ningún valor elegido.
    if (current.source === "district" && place !== null && norm(place.district) === norm(current.name)) {
      const same = options.find((o) => o.source === "list" && norm(o.name) === norm(current.name));
      if (same) return choiceOf(same);
    }
    const stays =
      current.source === "list"
        ? options.some((o) => o.source === "list" && o.zoneId === current.zoneId)
        : current.source === "district"
          ? place !== null && norm(place.district) === norm(current.name)
          : current.anchor !== null && distanceMeters(current.anchor, pin) <= ZONE_RADIUS_M;
    if (stays) return current;
  }
  return choiceOf(first);
}

/** Lo escrito en «Otra…», recortado como lo cuenta la base (`char_length(btrim())`). */
export const otherName = (text: string) => Array.from(text.trim()).slice(0, OTHER_ZONE_MAX).join("");

/** La zona elegida con «Otra…» (una sugerencia de Photon o lo escrito): si ya es una de las opciones (mismo nombre sin
 *  tildes ni mayúsculas), esa opción; si no, una zona propuesta anclada al pin. */
export function otherChoice(text: string, options: readonly ZoneSelectOption[], pin: LatLng): ZoneChoice {
  const name = otherName(text);
  const known = options.find((o) => norm(o.name) === norm(name));
  return known ? choiceOf(known) : { name, source: "other", zoneId: null, anchor: pin };
}

/** «{cantón}, {provincia}», p. ej. «Talamanca, Limón». */
export const placeLine = (place: Place): string => `${place.canton}, ${place.province}`;
