import { describe, expect, it } from "vitest";
import { APPROX_MAX_METERS, APPROX_MIN_METERS, distanceMeters, inCostaRica } from "../../src/domain/geo";

it("la zona aproximada va de 150 a 499 m, como approx_point en SQL", () => expect([APPROX_MIN_METERS, APPROX_MAX_METERS]).toEqual([150, 499]));

describe("distanceMeters", () => {
  it("un grado de latitud son ~111 km", () => {
    expect(Math.round(distanceMeters({ lat: 9, lng: -84 }, { lat: 10, lng: -84 }) / 1000)).toBe(111);
  });
});

describe("inCostaRica", () => {
  it("acepta puntos del país y rechaza el resto", () => {
    expect(inCostaRica(9.98, -83.03)).toBe(true);
    expect(inCostaRica(10.63, -85.44)).toBe(true);
    expect(inCostaRica(0, 0)).toBe(false);
    expect(inCostaRica(40.4, -3.7)).toBe(false);
  });
});
