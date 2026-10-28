import { describe, expect, it } from "vitest";
import { bboxAround, distanceMeters, type LatLng } from "../../src/domain/geo";
import {
  OTHER_ZONE_MAX,
  PLACE_DEBOUNCE_MS,
  ZONE_RADIUS_M,
  parsePhotonNear,
  photonNearUrl,
  placeLine,
  reconcileZone,
  searchZones,
  zoneOptions,
  type Zone,
  type ZoneChoice,
} from "../../src/domain/zones";

const PIN = { lat: 9.6438, lng: -82.7306 };
const place = { province: "Limón", canton: "Talamanca", district: "Cahuita", districtCode: "70403" };
const near = [
  { id: "704-cocles", name: "Cocles", distanceM: 120 },
  { id: "704-puerto-viejo", name: "Puerto Viejo", distanceM: 2902 },
];
/** Un punto a `m` metros al norte de `p`. */
const offset = (p: LatLng, m: number): LatLng => ({ lat: p.lat + m / 111_195, lng: p.lng });

it("constantes de la ubicación por punto", () => {
  expect([ZONE_RADIUS_M, OTHER_ZONE_MAX, PLACE_DEBOUNCE_MS]).toEqual([5000, 60, 300]);
});

describe("zoneOptions y reconcileZone", () => {
  it("zonas cercanas primero, luego el distrito, y la más cercana va preseleccionada", () => {
    const o = zoneOptions(near, place);
    expect(o.map((x) => [x.name, x.source])).toEqual([["Cocles", "list"], ["Puerto Viejo", "list"], ["Cahuita", "district"]]);
    expect(reconcileZone(null, PIN, o, place)).toEqual({ name: "Cocles", source: "list", zoneId: "704-cocles", anchor: null });
  });

  it("las zonas se ordenan por distancia aunque lleguen desordenadas, y las claves no se repiten", () => {
    const o = zoneOptions([...near].reverse(), place);
    expect(o.map((x) => x.name)).toEqual(["Cocles", "Puerto Viejo", "Cahuita"]);
    expect(new Set(o.map((x) => x.key)).size).toBe(3);
  });

  it("el distrito no se repite si una zona se llama igual (sin tildes ni mayúsculas)", () => {
    expect(zoneOptions([{ id: "704-cahuita", name: "Cahuita", distanceM: 300 }], place).map((x) => x.source)).toEqual(["list"]);
    expect(zoneOptions([{ id: "x", name: "LIMÓN", distanceM: 300 }], { ...place, district: "Limon" }).map((x) => x.source)).toEqual(["list"]);
  });

  it("sin lugar (fuera de tierra o buscando), solo las zonas cercanas", () => {
    expect(zoneOptions(near, null).map((x) => x.source)).toEqual(["list", "list"]);
    expect(zoneOptions([], null)).toEqual([]);
  });

  it("sin zonas cerca, el distrito es la única opción y queda elegido", () => {
    expect(reconcileZone(null, PIN, zoneOptions([], place), place)).toMatchObject({ name: "Cahuita", source: "district", zoneId: null });
  });

  it("una zona de la lista que sale del radio se cambia por la más cercana; si sigue, se queda", () => {
    const pv: ZoneChoice = { name: "Puerto Viejo", source: "list", zoneId: "704-puerto-viejo", anchor: null };
    expect(reconcileZone(pv, PIN, zoneOptions([near[0]!], place), place)).toMatchObject({ name: "Cocles", zoneId: "704-cocles" });
    expect(reconcileZone(pv, PIN, zoneOptions(near, place), place)).toBe(pv);
  });

  it("el distrito elegido se cambia si el pin pasa a otro distrito", () => {
    const cahuita: ZoneChoice = { name: "Cahuita", source: "district", zoneId: null, anchor: null };
    expect(reconcileZone(cahuita, PIN, zoneOptions([], place), place)).toBe(cahuita);
    const limon = { ...place, canton: "Limón", district: "Limón", districtCode: "70101" };
    const o = zoneOptions([{ id: "701-centro", name: "Limón centro", distanceM: 400 }], limon);
    expect(reconcileZone(cahuita, PIN, o, limon)).toMatchObject({ name: "Limón centro", source: "list" });
  });

  it("el distrito elegido cuya opción quitó una zona de la lista con el mismo nombre pasa a esa zona (la lista no queda sin valor)", () => {
    const cahuita: ZoneChoice = { name: "Cahuita", source: "district", zoneId: null, anchor: null };
    const o = zoneOptions([{ id: "704-cahuita", name: "Cahuita", distanceM: 300 }, ...near], place);
    expect(o.some((x) => x.source === "district")).toBe(false);
    expect(reconcileZone(cahuita, PIN, o, place)).toEqual({ name: "Cahuita", source: "list", zoneId: "704-cahuita", anchor: null });
    // Sin tildes ni mayúsculas, como el resto de comparaciones de nombres.
    expect(reconcileZone({ ...cahuita, name: "cahuíta" }, PIN, o, place)).toMatchObject({ source: "list", zoneId: "704-cahuita" });
  });

  const anchor = { lat: 9.8, lng: -82.93 };
  const other: ZoneChoice = { name: "Finca Los Almendros", source: "other", zoneId: null, anchor };

  it("'Otra…' se queda a 4,9 km de donde se eligió, aunque cambie el cantón; a 5,1 km se cambia", () => {
    const limon = { ...place, canton: "Limón", district: "Valle La Estrella" };
    expect(Math.round(distanceMeters(anchor, offset(anchor, 4900)))).toBe(4900);
    expect(reconcileZone(other, offset(anchor, 4900), zoneOptions([], limon), limon)).toBe(other);
    expect(reconcileZone(other, offset(anchor, 5100), zoneOptions([], limon), limon)).toMatchObject({ source: "district" });
  });

  it("sin opciones (buscando o sin red) no borra lo elegido", () => {
    expect(reconcileZone(other, PIN, [], null)).toBe(other);
    expect(reconcileZone(null, PIN, [], null)).toBeNull();
  });
});

it("placeLine: «{cantón}, {provincia}»", () => {
  expect(placeLine(place)).toBe("Talamanca, Limón");
});

describe("searchZones", () => {
  const zones: Zone[] = [
    { id: "101-escazu", name: "Escazú centro", cantonCode: "102", lat: 9.92, lng: -84.14 },
    { id: "704-cocles", name: "Cocles", cantonCode: "704", lat: 9.6438, lng: -82.7306 },
    { id: "701-centro", name: "Limón centro", cantonCode: "701", lat: 9.9932, lng: -83.0298 },
  ];
  it("sin texto: todas, las del Caribe (7xx) primero", () => {
    expect(searchZones(zones, "  ").map((z) => z.id)).toEqual(["704-cocles", "701-centro", "101-escazu"]);
    expect(searchZones(zones, "", 1).map((z) => z.id)).toEqual(["704-cocles"]);
  });
  it("con texto: filtra sin tildes ni mayúsculas", () => {
    expect(searchZones(zones, "coc").map((z) => z.name)).toEqual(["Cocles"]);
    expect(searchZones(zones, "limon").map((z) => z.name)).toEqual(["Limón centro"]);
    expect(searchZones(zones, "CENTRO").map((z) => z.id)).toEqual(["701-centro", "101-escazu"]);
    expect(searchZones(zones, "xyz")).toEqual([]);
  });
});

describe("bboxAround", () => {
  it("un rectángulo que llega a la distancia pedida en cada lado", () => {
    const [w, s, e, n] = bboxAround(PIN, 5000);
    expect(Math.round(distanceMeters(PIN, { lat: n, lng: PIN.lng }))).toBe(5000);
    expect(Math.round(distanceMeters(PIN, { lat: s, lng: PIN.lng }))).toBe(5000);
    expect(Math.round(distanceMeters(PIN, { lat: PIN.lat, lng: e }))).toBe(5000);
    expect(Math.round(distanceMeters(PIN, { lat: PIN.lat, lng: w }))).toBe(5000);
  });
});

describe("photonNearUrl", () => {
  it("texto corto: null", () => expect(photonNearUrl("co", PIN)).toBeNull());
  it("sin radio: rectángulo de Costa Rica, con sesgo al punto", () => {
    const u = new URL(photonNearUrl("Cocles", PIN)!);
    expect(u.origin + u.pathname).toBe("https://photon.komoot.io/api/");
    expect(u.searchParams.get("bbox")).toBe("-86,8,-82.5,11.3");
    expect([u.searchParams.get("lat"), u.searchParams.get("lon")]).toEqual([String(PIN.lat), String(PIN.lng)]);
    expect(u.searchParams.getAll("osm_tag")).toEqual(["place", "natural:beach"]);
  });
  it("con radio: el rectángulo alrededor del punto", () => {
    const u = new URL(photonNearUrl("Finca", PIN, ZONE_RADIUS_M)!);
    expect(u.searchParams.get("bbox")).toBe(bboxAround(PIN, ZONE_RADIUS_M).join(","));
  });
});

describe("parsePhotonNear", () => {
  const feature = (name: string, p: LatLng, extra: Record<string, unknown> = {}) => ({
    properties: { name, countrycode: "CR", county: "Talamanca", state: "Limón", ...extra },
    geometry: { coordinates: [p.lng, p.lat] },
  });
  const json = {
    features: [
      feature("Lejos", offset(PIN, 6000)),
      feature("Medio", offset(PIN, 3000)),
      feature("Cerca", offset(PIN, 200)),
      feature("Cerca", offset(PIN, 250)),
      feature("Panamá", offset(PIN, 100), { countrycode: "PA" }),
      feature("En el mar", { lat: 9.6, lng: -82.4 }),
      { properties: { countrycode: "CR" }, geometry: { coordinates: [PIN.lng, PIN.lat] } },
    ],
  };
  it("con radio: quita los de más de 5 km y los de fuera de Costa Rica, sin repetidos y por distancia", () => {
    expect(parsePhotonNear(json, PIN, ZONE_RADIUS_M).map((z) => z.name)).toEqual(["Cerca", "Medio"]);
    expect(parsePhotonNear(json, PIN, ZONE_RADIUS_M)[0]).toMatchObject({ detail: "Talamanca, Limón" });
  });
  it("sin radio: todo Costa Rica, por distancia, como mucho 5", () => {
    expect(parsePhotonNear(json, PIN).map((z) => z.name)).toEqual(["Cerca", "Medio", "Lejos"]);
    const many = { features: Array.from({ length: 8 }, (_, i) => feature(`Z${i}`, offset(PIN, 100 * (8 - i)))) };
    expect(parsePhotonNear(many, PIN).map((z) => z.name)).toEqual(["Z7", "Z6", "Z5", "Z4", "Z3"]);
  });
  it("respuesta inválida: vacío", () => {
    expect(parsePhotonNear(null, PIN)).toEqual([]);
    expect(parsePhotonNear({ features: "x" }, PIN)).toEqual([]);
  });
});
