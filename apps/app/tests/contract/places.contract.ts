// Contrato de PlacesApi (spec .scratch/ubicacion-por-punto/spec.md, «RPCs»): place_at con 500 m de margen en la costa,
// zones_near (activas, la más cercana primero) y la lista de zonas del paso 2. Corre contra PostgREST y el fake.
import { beforeAll, describe, expect, it } from "vitest";
import type { PlacesApi } from "../../src/domain/api";
import { BEACH_100, BEACH_600, COCLES, ESTRELLA, LIMON_CENTRO, MAR, PANAMA } from "./points";

/** Las zonas obligatorias de la migración `zonas`: nueve de Talamanca y Limón centro. */
export const REQUIRED_ZONES = [
  "704-puerto-viejo", "704-playa-negra", "704-cocles", "704-playa-chiquita", "704-punta-uva",
  "704-manzanillo", "704-cahuita", "704-hone-creek", "704-bribri", "701-limon-centro",
] as const;

export function placesContract(name: string, make: () => Promise<{ places: PlacesApi }>) {
  describe(`lugares · ${name}`, () => {
    let places: PlacesApi;
    beforeAll(async () => {
      places = (await make()).places;
    });

    it("Cocles: Limón / Talamanca / Cahuita", async () => {
      expect(await places.placeAt(COCLES.lat, COCLES.lng)).toEqual({ province: "Limón", canton: "Talamanca", district: "Cahuita", districtCode: "70403" });
    });

    it("Limón centro: cantón y distrito Limón", async () => {
      expect(await places.placeAt(LIMON_CENTRO.lat, LIMON_CENTRO.lng)).toMatchObject({ province: "Limón", canton: "Limón", district: "Limón" });
    });

    it("al otro lado del río Estrella: Valle La Estrella, cantón Limón", async () => {
      expect(await places.placeAt(ESTRELLA.lat, ESTRELLA.lng)).toEqual({ province: "Limón", canton: "Limón", district: "Valle La Estrella", districtCode: "70102" });
    });

    it("mar adentro, Panamá y a 600 m de la playa: null; a 100 m de la playa: el distrito más cercano", async () => {
      expect(await places.placeAt(MAR.lat, MAR.lng)).toBeNull();
      expect(await places.placeAt(PANAMA.lat, PANAMA.lng)).toBeNull();
      expect(await places.placeAt(BEACH_600.lat, BEACH_600.lng)).toBeNull();
      expect(await places.placeAt(BEACH_100.lat, BEACH_100.lng)).toMatchObject({ district: "Cahuita" });
    });

    it("zonas a 5 km de Cocles: Cocles primero, Puerto Viejo sí, Manzanillo no, en orden de distancia", async () => {
      const near = await places.zonesNear(COCLES.lat, COCLES.lng);
      expect(near[0]?.name).toBe("Cocles");
      const names = near.map((z) => z.name);
      expect(names).toContain("Puerto Viejo");
      expect(names).not.toContain("Manzanillo");
      const d = near.map((z) => z.distanceM);
      expect(d).toEqual([...d].sort((a, b) => a - b));
      expect(Math.max(...d)).toBeLessThanOrEqual(5000);
      for (const z of near) expect(Object.keys(z).sort()).toEqual(["distanceM", "id", "name"]);
    });

    it("a 10 km de Cocles ya entra Manzanillo", async () => {
      expect((await places.zonesNear(COCLES.lat, COCLES.lng, 10)).map((z) => z.name)).toContain("Manzanillo");
    });

    it("la lista de zonas trae las obligatorias, todas de Limón, Caribe primero", async () => {
      const zones = await places.listZones();
      const ids = zones.map((z) => z.id);
      for (const id of REQUIRED_ZONES) expect(ids).toContain(id);
      for (const z of zones) expect(z.cantonCode.startsWith("7")).toBe(true);
      expect(zones.find((z) => z.id === "704-cocles")).toEqual({ id: "704-cocles", name: "Cocles", cantonCode: "704", lat: 9.643783, lng: -82.730561 });
    });
  });
}
