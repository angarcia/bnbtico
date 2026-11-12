// Photon en el paso 2 (ubicación por punto): la URL del buscador del mapa y de «Otra…», y el filtrado de la respuesta.
import { describe, expect, it } from "vitest";
import { parsePhotonNear, photonNearUrl, ZONE_DEBOUNCE_MS, ZONE_QUERY_MIN, ZONE_SUGGESTIONS, ZONE_ZOOM } from "../../src/domain/place-search";

const NEAR = { lat: 9.6438, lng: -82.7306 };
const feature = (name: string, county: string, state: string, lng: number, lat: number, countrycode = "CR") => ({
  type: "Feature",
  properties: { name, county, state, country: "Costa Rica", countrycode, osm_key: "place", osm_value: "hamlet" },
  geometry: { type: "Point", coordinates: [lng, lat] },
});

it("constantes del buscador", () => {
  expect([ZONE_QUERY_MIN, ZONE_DEBOUNCE_MS, ZONE_SUGGESTIONS, ZONE_ZOOM]).toEqual([3, 300, 5, 15]);
});

describe("URL de Photon", () => {
  it("no busca con menos de 3 caracteres", () => {
    expect(photonNearUrl("co", NEAR)).toBeNull();
    expect(photonNearUrl("  co  ", NEAR)).toBeNull();
  });

  it("limita a Costa Rica, a lugares y playas, y sesga hacia el punto", () => {
    const url = new URL(photonNearUrl(" Cocles ", NEAR)!);
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api/");
    expect(url.searchParams.get("q")).toBe("Cocles");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("bbox")).toBe("-86,8,-82.5,11.3");
    expect(url.searchParams.get("lat")).toBe("9.6438");
    expect(url.searchParams.get("lon")).toBe("-82.7306");
    expect(url.searchParams.getAll("osm_tag")).toEqual(["place", "natural:beach"]);
    expect(url.searchParams.has("lang")).toBe(false);
  });
});

describe("parser de Photon", () => {
  it("nombre, contexto y punto", () => {
    expect(parsePhotonNear({ features: [feature("Cocles", "Talamanca", "Limón", -82.7305611, 9.6437829)] }, NEAR)).toEqual([
      { name: "Cocles", detail: "Talamanca, Limón", lat: 9.6437829, lng: -82.7305611 },
    ]);
  });

  it("fuera de Costa Rica, sin nombre, sin punto o basura: fuera", () => {
    const json = {
      features: [
        feature("Bocas", "Bocas del Toro", "Bocas del Toro", -82.24, 9.34, "PA"),
        feature("Isla del Coco", "Puntarenas", "Puntarenas", -87.06, 5.53),
        feature("", "Talamanca", "Limón", -82.7, 9.6),
        { properties: { name: "Sin punto", countrycode: "CR" } },
        null,
      ],
    };
    expect(parsePhotonNear(json, NEAR)).toEqual([]);
    expect(parsePhotonNear(null, NEAR)).toEqual([]);
    expect(parsePhotonNear("<html>", NEAR)).toEqual([]);
  });

  it("sin repetidos (mismo nombre y cantón)", () => {
    const json = { features: [feature("Playa Negra", "Talamanca", "Limón", -82.772, 9.658), feature("Playa Negra", "Talamanca", "Limón", -82.77, 9.659), feature("Playa Negra", "Santa Cruz", "Guanacaste", -85.88, 10.2)] };
    expect(parsePhotonNear(json, NEAR).map((z) => z.detail)).toEqual(["Talamanca, Limón", "Santa Cruz, Guanacaste"]);
  });
});
