// Centro de la zona elegida en el paso 2, solo para abrir el mapa del paso 3 con zoom (ticket 22). Vive en sessionStorage
// por casa: no va a la base ni a la ficha. En otro dispositivo, o si se escribió la zona a mano, el paso 3 usa la zona
// frecuente con ese nombre o, si no hay, la provincia (zoneCenter en domain/zones.ts).
import type { ZoneOption } from "../../domain/zones";

const key = (listingId: string) => `bnbtico_zone:${listingId}`;

export function rememberZone(listingId: string, zone: ZoneOption | null): void {
  try {
    if (zone) sessionStorage.setItem(key(listingId), JSON.stringify({ name: zone.name, lat: zone.lat, lng: zone.lng }));
    else sessionStorage.removeItem(key(listingId));
  } catch {
    /* sin almacenamiento: el paso 3 abre en la provincia */
  }
}

export function rememberedZone(listingId: string): { name: string; lat: number; lng: number } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key(listingId)) ?? "null") as unknown;
    if (v && typeof v === "object" && "name" in v && "lat" in v && "lng" in v) {
      const { name, lat, lng } = v as Record<string, unknown>;
      if (typeof name === "string" && typeof lat === "number" && typeof lng === "number") return { name, lat, lng };
    }
  } catch {
    /* valor roto o sin almacenamiento */
  }
  return null;
}
