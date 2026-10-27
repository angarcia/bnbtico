// Zonas del paso 2 (ticket 22): URL de Photon, parser y filtrado, zonas frecuentes y centro del mapa del paso 3.
import { describe, expect, it } from "vitest";
import { FREQUENT_ZONES, frequentZone, parsePhoton, photonUrl, zoneCenter } from "../../src/domain/zones";
import { inCostaRica } from "../../src/domain/geo";

const feature = (name: string, county: string, state: string, lng: number, lat: number, countrycode = "CR") => ({
  type: "Feature",
  properties: { name, county, state, country: "Costa Rica", countrycode, osm_key: "place", osm_value: "hamlet" },
  geometry: { type: "Point", coordinates: [lng, lat] },
});
const prefer = { province: "Limón", canton: "Talamanca" };

describe("URL de Photon", () => {
  it("no busca con menos de 3 caracteres", () => {
    expect(photonUrl("co", "Limón")).toBeNull();
    expect(photonUrl("  co  ", "Limón")).toBeNull();
  });

  it("limita a Costa Rica, a lugares y playas, y sesga hacia la provincia", () => {
    const url = new URL(photonUrl(" Cocles ", "Limón")!);
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api/");
    expect(url.searchParams.get("q")).toBe("Cocles");
    expect(url.searchParams.get("bbox")).toBe("-86,8,-82.5,11.3");
    expect(url.searchParams.get("lat")).toBe("9.98");
    expect(url.searchParams.get("lon")).toBe("-83.03");
    expect(url.searchParams.getAll("osm_tag")).toEqual(["place", "natural:beach"]);
    expect(url.searchParams.has("lang")).toBe(false);
  });
});

describe("parser de Photon", () => {
  it("nombre, contexto y punto", () => {
    expect(parsePhoton({ features: [feature("Cocles", "Talamanca", "Limón", -82.7305611, 9.6437829)] }, prefer)).toEqual([
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
    expect(parsePhoton(json, prefer)).toEqual([]);
    expect(parsePhoton(null, prefer)).toEqual([]);
    expect(parsePhoton("<html>", prefer)).toEqual([]);
  });

  it("sin repetidos (mismo nombre y cantón), primero el cantón, luego la provincia, como mucho 5", () => {
    const json = {
      features: [
        feature("Playa Negra", "Santa Cruz", "Guanacaste", -85.88, 10.2),
        feature("Playa Negra", "Puntarenas", "Puntarenas", -84.8, 9.9),
        feature("Playa Negra", "Talamanca", "Limón", -82.772, 9.658),
        feature("Playa Negra", "Talamanca", "Limón", -82.77, 9.659),
        feature("Playa Negra", "Limón", "Limón", -83.0, 9.95),
        feature("Playa Negrita", "Nicoya", "Guanacaste", -85.4, 9.9),
        feature("Playa Negra Sur", "Osa", "Puntarenas", -83.5, 8.9),
      ],
    };
    expect(parsePhoton(json, prefer).map((z) => z.detail)).toEqual(["Talamanca, Limón", "Limón, Limón", "Santa Cruz, Guanacaste", "Puntarenas, Puntarenas", "Nicoya, Guanacaste"]);
  });

  it("sin cantón elegido, la provincia manda", () => {
    const json = { features: [feature("Puerto Viejo", "Sarapiquí", "Heredia", -84.0, 10.45), feature("Puerto Viejo", "Talamanca", "Limón", -82.754, 9.656)] };
    expect(parsePhoton(json, { province: "Limón", canton: "" })[0]!.detail).toBe("Talamanca, Limón");
  });
});

describe("zonas frecuentes y centro del mapa", () => {
  it("las ocho del Caribe sur, todas en Costa Rica", () => {
    expect(FREQUENT_ZONES.map((z) => z.name)).toEqual(["Puerto Viejo", "Playa Negra", "Cocles", "Playa Chiquita", "Punta Uva", "Manzanillo", "Cahuita", "Limón centro"]);
    for (const z of FREQUENT_ZONES) expect(inCostaRica(z.lat, z.lng), z.name).toBe(true);
  });

  it("se reconocen sin tildes ni mayúsculas", () => {
    expect(frequentZone("  limon CENTRO ")?.name).toBe("Limón centro");
    expect(frequentZone("Otra cosa")).toBeNull();
    expect(frequentZone("")).toBeNull();
  });

  it("el centro elegido vale mientras el nombre sea el mismo; si no, el de una zona frecuente; si no, ninguno", () => {
    const chosen = { name: "Playa Negra", lat: 10.2, lng: -85.88 };
    expect(zoneCenter("Playa Negra", chosen)).toEqual({ lat: 10.2, lng: -85.88 });
    expect(zoneCenter("Cocles", chosen)).toEqual({ lat: 9.6438, lng: -82.7306 });
    expect(zoneCenter("Cerca del río", chosen)).toBeNull();
    expect(zoneCenter("Cerca del río", null)).toBeNull();
    expect(zoneCenter("Bocas", { name: "Bocas", lat: 9.34, lng: -82.24 })).toBeNull();
  });
});
